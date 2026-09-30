"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LANGS, type Lang, type MeeCommand, type MeeState, type SignalInput } from "@/domain/types";
import type { TtsInput } from "@/server/parse";

type Action = Exclude<MeeCommand, { kind: "signal" } | { kind: "tick" }>;

export type VoiceStatus = { key: string; phase: "loading" | "playing" } | null;
export type VoiceMode = "elevenlabs" | "mock" | "unavailable" | "unknown";

export const SPEECH_LANG: Record<Lang, string> = { fr: "fr-BE", nl: "nl-BE", en: "en-GB" };

export function voiceKey(req: TtsInput): string {
  switch (req.kind) {
    case "situation":
      return `situation:${req.situationId}:${req.channel}`;
    case "turn":
      return `turn:${req.turnId}`;
    case "classic_ivr":
      return "classic_ivr";
  }
}

type MeeCtx = {
  state: MeeState | null;
  now: number;
  error: string | null;
  lang: Lang;
  setLang: (l: Lang) => void;
  fire: (signal: SignalInput) => Promise<void>;
  act: (action: Action) => Promise<void>;
  speak: (req: TtsInput) => void;
  speakOnce: (req: TtsInput, opts?: { interrupt?: boolean }) => void;
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
const DEFAULT_LANG: Lang = "fr";
const langListeners = new Set<() => void>();
const subscribeLang = (fn: () => void) => {
  langListeners.add(fn);
  return () => langListeners.delete(fn);
};
const readLang = (): Lang => LANGS.find((l) => l === localStorage.getItem(LANG_KEY)) ?? DEFAULT_LANG;

export function MeeProvider({ children }: { children: React.ReactNode }) {
  const [snap, setSnap] = useState<{ state: MeeState; at: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lang = useSyncExternalStore(subscribeLang, readLang, () => DEFAULT_LANG);
  const [voice, setVoice] = useState<VoiceStatus>(null);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("unknown");

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(LANG_KEY, l);
    langListeners.forEach((fn) => fn());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

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

  const stopCurrent = useRef<() => void>(() => {});
  const queue = useRef<TtsInput[]>([]);
  const pumping = useRef(false);

  const play = useCallback(
    (req: TtsInput) =>
      new Promise<void>((resolve) => {
        const key = voiceKey(req);
        let settled = false;
        let audio: HTMLAudioElement | null = null;
        const done = () => {
          if (settled) return;
          settled = true;
          audio?.pause();
          setVoice((v) => (v?.key === key ? null : v));
          resolve();
        };
        stopCurrent.current = () => {
          window.speechSynthesis?.cancel();
          done();
        };
        const played = () => {
          if (req.kind === "situation") act({ kind: "voice_played", situationId: req.situationId, channel: req.channel });
        };
        setVoice({ key, phase: "loading" });

        (async () => {
          const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
          if (!res.ok) throw new Error(`tts ${res.status}`);
          if (settled) return;
          if (res.headers.get("Content-Type")?.startsWith("audio/")) {
            setVoiceMode("elevenlabs");
            audio = new Audio(URL.createObjectURL(await res.blob()));
            audio.onended = done;
            audio.onerror = done;
            setVoice({ key, phase: "playing" });
            await audio.play();
            played();
            return;
          }
          const { text, lang: scriptLang } = (await res.json()) as { text: string; lang: Lang };
          if (!("speechSynthesis" in window)) {
            setVoiceMode("unavailable");
            return done();
          }
          const u = new SpeechSynthesisUtterance(text);
          u.lang = SPEECH_LANG[scriptLang];
          u.rate = 1.02;
          u.onstart = () => {
            setVoiceMode("mock");
            setVoice({ key, phase: "playing" });
            played();
            // Some browsers never fire onend, so the playing state also ends on a length-based timer.
            setTimeout(done, 1500 + text.length * 65);
          };
          u.onend = done;
          u.onerror = (e) => {
            if (e.error !== "interrupted" && e.error !== "canceled") setVoiceMode("unavailable");
            done();
          };
          window.speechSynthesis.speak(u);
        })().catch(done);
      }),
    [act],
  );

  const pump = useCallback(async () => {
    if (pumping.current) return;
    pumping.current = true;
    while (queue.current.length) await play(queue.current.shift()!);
    pumping.current = false;
  }, [play]);

  const speak = useCallback(
    (req: TtsInput) => {
      queue.current = [req];
      stopCurrent.current();
      pump();
    },
    [pump],
  );

  const seen = useRef(new Set<string>());
  const speakOnce = useCallback(
    (req: TtsInput, opts?: { interrupt?: boolean }) => {
      const key = voiceKey(req);
      if (seen.current.has(key)) return;
      seen.current.add(key);
      if (opts?.interrupt) return speak(req);
      queue.current.push(req);
      pump();
    },
    [pump, speak],
  );

  return (
    <Ctx.Provider value={{ state: snap?.state ?? null, now: snap?.at ?? 0, error, lang, setLang, fire, act, speak, speakOnce, voice, voiceMode }}>{children}</Ctx.Provider>
  );
}
