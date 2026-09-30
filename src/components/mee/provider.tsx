"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Channel, Lang, MeeCommand, MeeState, SignalInput } from "@/domain/types";

type Action = Exclude<MeeCommand, { kind: "signal" } | { kind: "tick" }>;

export type VoiceStatus = { key: string; phase: "loading" | "playing" } | null;
export type VoiceMode = "elevenlabs" | "mock" | "unavailable" | "unknown";

type MeeCtx = {
  state: MeeState | null;
  now: number;
  error: string | null;
  lang: Lang;
  setLang: (l: Lang) => void;
  fire: (signal: SignalInput) => Promise<void>;
  act: (action: Action) => Promise<void>;
  speak: (situationId: string, channel: Channel) => Promise<void>;
  speakOnce: (situationId: string, channel: Channel) => void;
  voice: VoiceStatus;
  voiceMode: VoiceMode;
};

const Ctx = createContext<MeeCtx | null>(null);

export function useMee() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMee outside MeeProvider");
  return ctx;
}

async function post(url: string, body: unknown): Promise<MeeState> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

const LANG_KEY = "mee-lang";
const langListeners = new Set<() => void>();
const subscribeLang = (fn: () => void) => {
  langListeners.add(fn);
  return () => langListeners.delete(fn);
};
const readLang = (): Lang => (localStorage.getItem(LANG_KEY) === "nl" ? "nl" : "en");

export function MeeProvider({ children }: { children: React.ReactNode }) {
  const [snap, setSnap] = useState<{ state: MeeState; at: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lang = useSyncExternalStore(subscribeLang, readLang, () => "en" as const);
  const [voice, setVoice] = useState<VoiceStatus>(null);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("unknown");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(LANG_KEY, l);
    langListeners.forEach((fn) => fn());
  }, []);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/situation", { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const next: MeeState = await res.json();
        if (alive) {
          setSnap({ state: next, at: Date.now() });
          setError(null);
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    poll();
    const t = setInterval(poll, 900);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const run = useCallback(async (p: Promise<MeeState>) => {
    try {
      const next = await p;
      setSnap({ state: next, at: Date.now() });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const fire = useCallback((signal: SignalInput) => run(post("/api/events", signal)), [run]);
  const act = useCallback((action: Action) => run(post("/api/actions", action)), [run]);

  const speak = useCallback(
    async (situationId: string, channel: Channel) => {
      const key = `${situationId}:${channel}`;
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      setVoice({ key, phase: "loading" });
      const done = () => setVoice((v) => (v?.key === key ? null : v));
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ situationId, channel, lang }),
        });
        if (!res.ok) throw new Error(`tts ${res.status}`);
        if (res.headers.get("Content-Type")?.startsWith("audio/")) {
          setVoiceMode("elevenlabs");
          const audio = new Audio(URL.createObjectURL(await res.blob()));
          audioRef.current = audio;
          audio.onended = done;
          audio.onerror = done;
          setVoice({ key, phase: "playing" });
          await audio.play();
          act({ kind: "voice_played", situationId, channel });
        } else {
          const { text } = (await res.json()) as { text: string };
          if (!("speechSynthesis" in window)) {
            setVoiceMode("unavailable");
            return done();
          }
          const u = new SpeechSynthesisUtterance(text);
          u.lang = lang === "nl" ? "nl-BE" : "en-GB";
          u.rate = 1.02;
          u.onstart = () => {
            setVoiceMode("mock");
            setVoice({ key, phase: "playing" });
            act({ kind: "voice_played", situationId, channel });
            // Some browsers never fire onend, so the playing state also ends on a length-based timer.
            setTimeout(done, 1500 + text.length * 60);
          };
          u.onend = done;
          u.onerror = () => {
            setVoiceMode("unavailable");
            done();
          };
          window.speechSynthesis.speak(u);
        }
      } catch {
        done();
      }
    },
    [lang, act],
  );

  const autoplayed = useRef(new Set<string>());
  const speakOnce = useCallback(
    (situationId: string, channel: Channel) => {
      if (autoplayed.current.has(situationId)) return;
      autoplayed.current.add(situationId);
      speak(situationId, channel);
    },
    [speak],
  );

  return (
    <Ctx.Provider value={{ state: snap?.state ?? null, now: snap?.at ?? 0, error, lang, setLang, fire, act, speak, speakOnce, voice, voiceMode }}>{children}</Ctx.Provider>
  );
}
