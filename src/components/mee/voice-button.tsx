"use client";

import { Loader2, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TtsInput } from "@/server/parse";
import { COPY } from "./copy";
import { useMee, voiceKey } from "./provider";

export function VoiceButton({ request, label, className, showMode = true }: { request: TtsInput; label?: string; className?: string; showMode?: boolean }) {
  const { speak, voice, voiceMode, lang } = useMee();
  const t = COPY[lang].customer;
  const phase = voice?.key === voiceKey(request) ? voice.phase : null;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        onClick={() => speak(request)}
        aria-label={label ?? t.listen}
        className={cn(
          "group flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border pr-4 pl-1 text-sm font-medium transition-colors",
          phase ? "border-mee bg-mee-soft text-ink" : "bg-card hover:bg-muted",
        )}
      >
        <span className={cn("flex size-8 items-center justify-center rounded-full text-white transition-colors", phase ? "bg-mee" : "bg-ink")}>
          {phase === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}
        </span>
        {phase === "playing" ? <Waveform /> : null}
        <span>{phase === "loading" ? t.loadingVoice : phase === "playing" ? t.playing : (label ?? t.listen)}</span>
      </button>
      {showMode && voiceMode !== "unknown" && (
        <span className="text-[11px] leading-tight text-muted-foreground">{voiceMode === "elevenlabs" ? t.voiceEleven : voiceMode === "mock" ? t.voiceMock : t.voiceUnavailable}</span>
      )}
    </div>
  );
}

export function Waveform({ className }: { className?: string }) {
  return (
    <span className={cn("flex h-4 items-end gap-[3px]", className)} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="w-[3px] rounded-full bg-mee animate-[mee-wave_0.9s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  );
}
