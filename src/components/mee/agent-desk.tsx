"use client";

import { useEffect } from "react";
import {
  AlertTriangle, Ban, Banknote, BellOff, CheckCircle2, ChevronDown, Clock, CreditCard, Euro, Hash, Headphones, ListChecks, MapPin, Phone, ShieldCheck, Smartphone, Sparkles, Store, Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { activeSituation, agentScript, callSituation, liveCall, situationSlots } from "@/domain/engine";
import { APP_PLAYBOOKS, SITUATION_LABEL } from "@/domain/playbooks";
import { RULES, fill, situationFacts, type FactIcon } from "@/domain/rules";
import type { Call, MeeState, Situation, TimelineEntry } from "@/domain/types";
import { Transcript } from "./call-screen";
import { COPY, fmtAgo, fmtClock, fmtTime } from "./copy";
import { useMee } from "./provider";
import { VoiceButton } from "./voice-button";

const FACT_ICON: Record<FactIcon, LucideIcon> = {
  place: MapPin,
  card: CreditCard,
  merchant: Store,
  amount: Euro,
  code: Hash,
  salary: Banknote,
  balance: Wallet,
  muted: BellOff,
  clean: ShieldCheck,
};

const KIND_STYLE: Record<TimelineEntry["kind"], string> = {
  signal: "bg-sky-500",
  situation: "bg-mee",
  channel: "bg-violet-500",
  privacy: "bg-emerald-600",
};

export function AgentDesk() {
  const { state } = useMee();
  if (!state) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;

  const call = liveCall(state);
  const sit = callSituation(state);
  if (call && sit && call.phase === "with_agent") return <HandedOff state={state} call={call} situation={sit} />;
  if (call && sit) return <MeeOnLine call={call} situation={sit} />;
  return <Waiting state={state} />;
}

function Waiting({ state }: { state: MeeState }) {
  const { lang, now } = useMee();
  const t = COPY[lang].agent;
  const sit = state.prefs.meePaused ? undefined : activeSituation(state);
  const last = state.call;
  const lastSit = last && state.situations.find((s) => s.id === last.situationId);
  const lastLine = last && lastSit && (lastSit.status !== "resolved" ? t.lastCallOther : last.handedOffAt ? t.lastCallAgent : t.lastCallMee);

  return (
    <div data-testid="agent-waiting" className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><Headphones className="size-5" /></span>
      <p className="text-base font-semibold">{t.waiting}</p>
      <p className="max-w-md text-sm text-muted-foreground">
        {sit ? t.knows(SITUATION_LABEL[sit.type][lang], RULES[sit.type].name.split(" · ")[0], fmtAgo(now - sit.createdAt, lang)) : t.knowsNothing}
      </p>
      {lastLine && (
        <p className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="size-3.5" /> {lastLine}
        </p>
      )}
    </div>
  );
}

function MeeOnLine({ call, situation }: { call: Call; situation: Situation }) {
  const { lang, now } = useMee();
  const t = COPY[lang].agent;
  return (
    <div data-testid="agent-mee-on-line" className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-2xl border border-mee/40 bg-mee-soft px-4 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mee text-white animate-[mee-pulse_1.4s_ease-out_infinite]"><Sparkles className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t.meeOnLine}</p>
          <p className="text-xs text-muted-foreground">{t.meeOnLineSub}</p>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{fmtClock(now - call.startedAt)}</span>
      </div>
      <section className="rounded-2xl border bg-card p-4">
        <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{SITUATION_LABEL[situation.type][lang]}</p>
        <Transcript call={call} tone="light" className="max-h-[420px]" />
      </section>
    </div>
  );
}

function HandedOff({ state, call, situation }: { state: MeeState; call: Call; situation: Situation }) {
  const { lang, now, act, speakOnce } = useMee();
  const t = COPY[lang].agent;
  const agent = agentScript(state, situation);
  const app = APP_PLAYBOOKS[situation.type];
  const whisper = fill(agent.whisper[lang], situationSlots(state, situation, lang));
  const facts = situationFacts(situation.type, situation.signals, lang);
  const active = situation.status === "active";
  const whisperRequest = { kind: "situation", situationId: situation.id, channel: "agent", lang } as const;

  useEffect(() => {
    speakOnce({ kind: "situation", situationId: situation.id, channel: "agent", lang });
  }, [speakOnce, situation.id, lang]);

  return (
    <div data-testid="agent-handed-off" className="@container flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white animate-[mee-pulse_1.4s_ease-out_infinite]"><Phone className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t.incoming}</p>
          <p className="text-xs text-muted-foreground">{t.incomingSub}</p>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{fmtClock(now - (call.handedOffAt ?? call.startedAt))}</span>
      </div>

      <div className="grid gap-4 @min-[56rem]:grid-cols-2">
        <div className="flex flex-col gap-4">
          <article data-testid="agent-situation-card" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <header className={cn("flex items-center gap-2 px-4 py-3 text-white", app.urgency === "time_critical" ? "bg-gradient-to-r from-red-600 to-orange-500" : "bg-gradient-to-r from-amber-500 to-orange-400")}>
              <AlertTriangle className="size-5 shrink-0" />
              <h3 className="min-w-0 flex-1 text-lg leading-tight font-semibold">{SITUATION_LABEL[situation.type][lang]}</h3>
              {!active && <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-medium">{t.resolved}</span>}
            </header>
            <ul className="flex flex-col divide-y">
              {facts.map((f) => {
                const Icon = FACT_ICON[f.icon];
                return (
                  <li key={f.text} className="flex items-center gap-3 px-4 py-2.5 text-[15px]">
                    <Icon className="size-4 shrink-0 text-muted-foreground" /> {f.text}
                  </li>
                );
              })}
              <li className="flex items-start gap-3 bg-mee-soft/60 px-4 py-2.5 text-[15px]">
                <ListChecks className="mt-0.5 size-4 shrink-0 text-mee-strong" />
                <span><span className="font-semibold">{t.recommended}</span> {agent.recommended[lang]}</span>
              </li>
              <li className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground">
                <Clock className="size-3.5 shrink-0" /> {t.detected(fmtAgo(now - situation.createdAt, lang))} · <span className="font-mono">{RULES[situation.type].name.split(" · ")[0]}</span>
              </li>
            </ul>
            <div className="border-t p-3">
              {active ? (
                <Button data-testid="agent-resolve" size="lg" className="h-11 w-full text-sm" onClick={() => act({ kind: "cta", situationId: situation.id, action: "agent_resolve", lang })}>
                  <CheckCircle2 /> {agent.ctaLabel[lang]}
                </Button>
              ) : (
                <Button size="lg" variant="outline" className="h-11 w-full text-sm" onClick={() => act({ kind: "end_call", callId: call.id })}>
                  <CheckCircle2 /> {t.closeCall}
                </Button>
              )}
            </div>
          </article>

          <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-violet-700 uppercase"><Headphones className="size-3.5" /> {t.say}</h4>
            <p data-testid="agent-whisper" className="mt-2 text-[15px] leading-relaxed">{whisper}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <VoiceButton request={whisperRequest} label={t.replay} showMode={false} />
              <span className="font-mono text-[11px] text-muted-foreground">{agent.version}</span>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border bg-card p-4">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"><Ban className="size-3.5" /> {t.dontAsk}</h4>
            <ul data-testid="agent-dont-ask" className="mt-2 flex flex-wrap gap-1.5">
              {facts.flatMap((f) => {
                const topic = t.topics[f.icon];
                return topic ? [<li key={f.icon} className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-sm"><CheckCircle2 className="size-3.5 text-emerald-600" />{topic}</li>] : [];
              })}
            </ul>
          </section>

          <section className="rounded-2xl border bg-card p-4">
            <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t.sawHeard}</h4>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><Smartphone className="size-3.5" /> {t.inApp}</p>
            <blockquote data-testid="agent-readback" className="mt-1 border-l-2 border-mee pl-3 text-sm leading-relaxed">{app.scriptText[lang]}</blockquote>
            <p className="mt-4 mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><Phone className="size-3.5" /> {t.onCall}</p>
            <Transcript call={call} tone="light" className="max-h-72" />
          </section>

          <details className="group rounded-2xl border bg-card p-4">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <Clock className="size-3.5" /> {t.history}
              <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" />
            </summary>
            <ol className="mt-3 flex flex-col gap-3">
              {[...state.timeline].reverse().filter((e) => !e.situationId || e.situationId === situation.id).slice(0, 30).map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", KIND_STYLE[e.kind])} />
                  <div className="min-w-0">
                    <p className="leading-snug">{e.text[lang]}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{fmtTime(e.at, lang)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </details>
        </div>
      </div>
    </div>
  );
}
