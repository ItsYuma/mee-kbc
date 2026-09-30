"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, Headphones, Loader2, Mic, PhoneOff, Sparkles, Square, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VOICE_FLOWS } from "@/domain/playbooks";
import type { Call, Situation, Turn } from "@/domain/types";
import { COPY, fmtClock } from "./copy";
import { useMee } from "./provider";
import { useVoiceInput, type MicNotice, type SttEngine } from "./use-voice-input";
import { Waveform } from "./voice-button";

const HANDOFF_BANNER_MS = 3500;
export const ENDED_CARD_MS = 8000;

export function CallScreen({ call, situation, onClose }: { call: Call; situation: Situation; onClose: () => void }) {
  const { now, act, speakOnce, voice } = useMee();
  const t = COPY[call.lang].call;
  const flow = VOICE_FLOWS[situation.type];
  const withAgent = call.phase === "with_agent";
  const ended = call.phase === "ended";

  useEffect(() => {
    call.turns.forEach((turn, i) => {
      if (turn.speaker === "mee") speakOnce({ kind: "turn", callId: call.id, turnId: turn.id }, { interrupt: i === 0 });
    });
  }, [call.id, call.turns, speakOnce]);

  const say = (text: string, source: "speech" | "quick_reply") => act({ kind: "customer_said", callId: call.id, text, source });
  const human = flow.choices.find((c) => c.id === "human");
  const meeSpeaking = !!voice && voice.key.startsWith("turn:");
  const handingOff = withAgent && call.handedOffAt !== undefined && now - call.handedOffAt < HANDOFF_BANNER_MS;

  if (ended) {
    const resolved = situation.status === "resolved";
    const lastMee = call.turns.findLast((turn) => turn.speaker === "mee");
    return (
      <div data-testid="call-ended" className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-ink px-8 text-center text-white animate-[mee-rise_0.3s_ease-out]">
        <span className={cn("flex size-16 items-center justify-center rounded-full", resolved ? "bg-emerald-500" : "bg-white/15")}>
          {resolved ? <CheckCircle2 className="size-8" /> : <PhoneOff className="size-7" />}
        </span>
        <div>
          <p className="text-lg font-semibold">{t.ended} · {fmtClock((call.endedAt ?? now) - call.startedAt)}</p>
          <p className="mt-1 text-sm text-white/75">{resolved ? t.endedResolved : t.endedOther}</p>
        </div>
        {resolved && lastMee && <p className="rounded-2xl bg-white/10 px-4 py-3 text-sm leading-snug text-white/90">{lastMee.text}</p>}
        <Button variant="outline" className="mt-2 h-10 border-white/25 bg-white/10 px-5 text-white hover:bg-white/20 hover:text-white" onClick={onClose}>{t.back}</Button>
      </div>
    );
  }

  return (
    <div data-testid="call-screen" data-phase={call.phase} className="absolute inset-0 z-40 flex flex-col bg-ink text-white animate-[mee-rise_0.3s_ease-out]">
      <header className="flex items-center justify-between px-5 pt-3 pb-2 text-xs text-white/70">
        <span className="font-medium text-white">{withAgent ? t.agentTitle : t.title}</span>
        <span className="font-mono tabular-nums">{fmtClock(now - call.startedAt)}</span>
      </header>

      <div className="flex flex-col items-center gap-2 pt-1 pb-3">
        <span
          className={cn(
            "flex size-16 items-center justify-center rounded-full transition-colors",
            withAgent ? "bg-emerald-500" : "bg-mee",
            (meeSpeaking || handingOff) && "animate-[mee-pulse_1.4s_ease-out_infinite]",
          )}
        >
          {withAgent ? <UserRound className="size-7" /> : <Sparkles className="size-7" />}
        </span>
        <p className="flex h-5 items-center gap-2 text-sm font-medium">
          {withAgent ? (handingOff ? t.handingOff : t.withAgent) : t.mee}
          {meeSpeaking && <Waveform />}
        </p>
      </div>

      <Transcript call={call} tone="dark" className="min-h-0 flex-1 px-4" />

      <div className="flex flex-col gap-3 border-t border-white/10 px-4 pt-3 pb-5">
        {withAgent ? (
          <p className="flex items-center justify-center gap-2 text-center text-xs text-white/75"><Headphones className="size-4" /> {t.agentKnows}</p>
        ) : (
          <>
            <MicControl callId={call.id} lang={call.lang} onText={(text) => say(text, "speech")} />
            <div>
              <p className="mb-1.5 text-[11px] text-white/60">{t.quickReplies}</p>
              <div className="flex flex-wrap gap-1.5">
                {flow.choices.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    data-testid="quick-reply"
                    onClick={() => say(c.quickReply[call.lang], "quick_reply")}
                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-left text-xs font-medium hover:bg-white/20"
                  >
                    {c.quickReply[call.lang]}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <div className="flex gap-2">
          {!withAgent && human && (
            <Button variant="outline" className="h-10 flex-1 border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => say(human.quickReply[call.lang], "quick_reply")}>
              <Headphones /> {t.toAgent}
            </Button>
          )}
          <Button className="h-10 flex-1 bg-red-600 text-white hover:bg-red-700" onClick={() => act({ kind: "end_call", callId: call.id })}>
            <PhoneOff /> {t.hangUp}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MicControl({ callId, lang, onText }: { callId: string; lang: Call["lang"]; onText: (text: string) => void }) {
  const t = COPY[lang].call;
  const mic = useVoiceInput({ callId, lang, onText });
  const recording = mic.phase === "recording";
  const disabled = mic.engine === "none" || mic.engine === "unknown" || mic.phase === "transcribing";
  const hint = recording ? (mic.interim || t.listening) : mic.phase === "transcribing" ? t.transcribing : noticeText(mic.notice, mic.engine, t) ?? t.tapToTalk;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        data-testid="mic"
        aria-label={recording ? t.listening : t.tapToTalk}
        aria-pressed={recording}
        disabled={disabled}
        onClick={mic.toggle}
        className={cn(
          "relative flex size-14 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40",
          recording ? "bg-red-500" : "bg-white text-ink hover:bg-white/90",
        )}
      >
        {recording && (
          <span
            className="absolute inset-0 rounded-full bg-red-500/40 transition-transform duration-75"
            style={{ transform: `scale(${1.15 + (mic.engine === "browser" ? 0.2 : mic.level * 0.6)})` }}
            aria-hidden
          />
        )}
        <span className="relative">
          {mic.phase === "transcribing" ? <Loader2 className="size-6 animate-spin" /> : recording ? <Square className="size-5 fill-current" /> : <Mic className="size-6" />}
        </span>
      </button>
      <div className="min-w-0">
        <p className={cn("text-sm leading-snug", recording ? "text-white" : "text-white/85")}>{hint}</p>
        <p className="mt-0.5 text-[11px] leading-tight text-white/55">
          {engineLabel(mic.engine, t)}{engineLabel(mic.engine, t) && " · "}{t.keywordsOnly}
        </p>
      </div>
    </div>
  );
}

type CallCopy = (typeof COPY)["fr"]["call"];

function noticeText(notice: MicNotice, engine: SttEngine, t: CallCopy): string | null {
  if (engine === "none") return t.micUnavailable;
  switch (notice) {
    case "unavailable":
      return t.micUnavailable;
    case "denied":
      return t.micDenied;
    case "empty":
      return t.heardNothing;
    case null:
      return null;
  }
}

function engineLabel(engine: SttEngine, t: CallCopy): string {
  switch (engine) {
    case "elevenlabs":
      return t.sttEleven;
    case "openai":
      return t.sttOpenai;
    case "browser":
      return t.sttBrowser;
    case "none":
    case "unknown":
      return "";
  }
}

export function Transcript({ call, tone, className }: { call: Call; tone: "dark" | "light"; className?: string }) {
  const { state } = useMee();
  const t = COPY[call.lang].call;
  const ref = useRef<HTMLOListElement>(null);
  const name = state?.customer.name.split(" ")[0] ?? "";

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [call.turns.length]);

  return (
    <ol ref={ref} data-testid="transcript" className={cn("flex flex-col gap-2.5 overflow-y-auto pb-2", className)}>
      {call.turns.map((turn) => (
        <li key={turn.id} className={cn("flex max-w-[85%] flex-col gap-0.5", turn.speaker === "customer" ? "items-end self-end" : "items-start self-start")}>
          <span className={cn("text-[10px] font-medium", tone === "dark" ? "text-white/55" : "text-muted-foreground")}>
            {turn.speaker === "mee" ? t.mee : name}
            {turn.speaker === "customer" && ` · ${turnTag(turn, t)}`}
          </span>
          <p
            className={cn(
              "rounded-2xl px-3 py-2 text-[13px] leading-snug",
              turn.speaker === "mee"
                ? tone === "dark" ? "rounded-tl-sm bg-white/12 text-white" : "rounded-tl-sm bg-mee-soft text-foreground"
                : tone === "dark" ? "rounded-tr-sm bg-mee text-white" : "rounded-tr-sm bg-ink text-white",
            )}
          >
            {turn.text}
          </p>
        </li>
      ))}
    </ol>
  );
}

function turnTag(turn: Extract<Turn, { speaker: "customer" }>, t: CallCopy): string {
  switch (turn.source) {
    case "speech":
      return t.transcribed;
    case "quick_reply":
      return t.quickReply;
  }
}
