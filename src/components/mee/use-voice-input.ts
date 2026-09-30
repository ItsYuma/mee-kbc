"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "@/domain/types";
import { SPEECH_LANG } from "./provider";

type Recognizer = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognizerCtor = new () => Recognizer;

export type SttEngine = "elevenlabs" | "openai" | "browser" | "none" | "unknown";
export type MicPhase = "idle" | "recording" | "transcribing";
export type MicNotice = "unavailable" | "denied" | "empty" | null;

const MAX_RECORDING_MS = 8000;

function browserRecognizer(): RecognizerCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceInput({ callId, lang, onText }: { callId: string; lang: Lang; onText: (text: string) => void }) {
  const [engine, setEngine] = useState<SttEngine>("unknown");
  const [phase, setPhase] = useState<MicPhase>("idle");
  const [notice, setNotice] = useState<MicNotice>(null);
  const [level, setLevel] = useState(0);
  const [interim, setInterim] = useState("");
  const stopRef = useRef<(() => void) | null>(null);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => {
    let alive = true;
    fetch("/api/stt")
      .then((r) => r.json() as Promise<{ mode: "elevenlabs" | "openai" | "mock" }>)
      .catch(() => ({ mode: "mock" as const }))
      .then(({ mode }) => {
        if (alive) setEngine(mode !== "mock" ? mode : browserRecognizer() ? "browser" : "none");
      });
    return () => {
      alive = false;
      stopRef.current?.();
    };
  }, []);

  const startServer = useCallback(async () => {
    const stream = await navigator.mediaDevices?.getUserMedia({ audio: true }).catch(() => null);
    if (!stream) return setNotice("denied");

    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let frame = 0;
    const meter = () => {
      analyser.getByteTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / samples.length);
      setLevel(Math.min(1, rms * 4));
      frame = requestAnimationFrame(meter);
    };
    meter();

    const timeout = setTimeout(() => recorder.state === "recording" && recorder.stop(), MAX_RECORDING_MS);
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = async () => {
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
      stream.getTracks().forEach((t) => t.stop());
      audioCtx.close();
      setLevel(0);
      stopRef.current = null;
      setPhase("transcribing");
      const type = recorder.mimeType || "audio/webm";
      const form = new FormData();
      form.set("audio", new Blob(chunks, { type }), `speech.${type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm"}`);
      form.set("callId", callId);
      form.set("lang", lang);
      const res = await fetch("/api/stt", { method: "POST", body: form })
        .then((r) => r.json() as Promise<{ mode: string; text?: string }>)
        .catch(() => ({ mode: "mock" as const, text: undefined }));
      setPhase("idle");
      if (res.text) onTextRef.current(res.text);
      else setNotice(res.mode === "mock" ? "unavailable" : "empty");
    };
    stopRef.current = () => recorder.state === "recording" && recorder.stop();
    recorder.start();
    setPhase("recording");
  }, [callId, lang]);

  const startBrowser = useCallback(() => {
    const Ctor = browserRecognizer();
    if (!Ctor) return setNotice("unavailable");
    const rec = new Ctor();
    rec.lang = SPEECH_LANG[lang];
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = "";
    let failed = false;
    rec.onresult = (e) => {
      let live = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else live += r[0].transcript;
      }
      setInterim(finalText || live);
    };
    rec.onerror = (e) => {
      failed = true;
      setNotice(e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied" : e.error === "no-speech" ? "empty" : "unavailable");
    };
    rec.onend = () => {
      stopRef.current = null;
      setPhase("idle");
      setInterim("");
      const text = finalText.trim();
      if (text) onTextRef.current(text);
      else if (!failed) setNotice("empty");
    };
    stopRef.current = () => rec.stop();
    rec.start();
    setPhase("recording");
  }, [lang]);

  const toggle = useCallback(() => {
    if (phase === "recording") return stopRef.current?.();
    if (phase !== "idle") return;
    setNotice(null);
    if (engine === "elevenlabs" || engine === "openai") startServer();
    else if (engine === "browser") startBrowser();
    else setNotice("unavailable");
  }, [phase, engine, startServer, startBrowser]);

  return { engine, phase, notice, level, interim, toggle };
}
