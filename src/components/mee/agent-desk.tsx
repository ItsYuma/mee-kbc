"use client";

import { Ban, CheckCircle2, Clock, Headphones, MessageSquareQuote, Phone, Radio, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { agentSituation } from "@/domain/engine";
import { PLAYBOOKS, SITUATION_LABEL } from "@/domain/playbooks";
import { RULES } from "@/domain/rules";
import type { SituationStatus, TimelineEntry } from "@/domain/types";
import { fmtEur, fmtTime, fmtUntil } from "./copy";
import { useMee } from "./provider";
import { VoiceButton } from "./voice-button";

const STATUS_STYLE: Record<SituationStatus, string> = {
  active: "bg-mee-strong text-white",
  resolved: "bg-emerald-600 text-white",
  dismissed: "bg-muted text-muted-foreground",
  suppressed: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
};

const KIND_STYLE: Record<TimelineEntry["kind"], string> = {
  signal: "bg-sky-500",
  situation: "bg-mee",
  channel: "bg-violet-500",
  privacy: "bg-emerald-600",
};

export function AgentDesk() {
  const { state, lang, act } = useMee();
  if (!state) return <div className="h-full animate-pulse rounded-2xl bg-muted" />;

  const sit = agentSituation(state);
  const call = state.supportCall;
  const nl = lang === "nl";

  return (
    <div className="flex flex-col gap-4">
      <div className={cn("flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3", call ? "border-emerald-300 bg-emerald-50" : "bg-card")}>
        <span className={cn("flex size-10 items-center justify-center rounded-full", call ? "bg-emerald-500 text-white animate-[mee-pulse_1.4s_ease-out_infinite]" : "bg-muted text-muted-foreground")}>
          {call ? <Phone className="size-4" /> : <Radio className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {call ? (nl ? "Inkomend gesprek · Lotte Peeters" : "Incoming call · Lotte Peeters") : nl ? "Geen gesprek · situatiebus live" : "No call · situation bus live"}
          </p>
          <p className="text-xs text-muted-foreground">
            {call
              ? `${nl ? "Verbonden om" : "Connected at"} ${fmtTime(call.startedAt, lang)} · ${nl ? "context al geladen" : "context already loaded"}`
              : nl ? "Zodra de klant belt, opent dit scherm met dezelfde situatie." : "When the customer calls, this screen opens on the same situation."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <UserRound className="size-4" />
          <span>{state.customer.name} · {state.customer.city} · {fmtEur(state.customer.balanceEur, lang)}</span>
        </div>
      </div>

      {!sit ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
          <ShieldCheck className="size-6 text-emerald-600" />
          <p className="text-sm font-medium">{nl ? "Stil. Geen situaties voor deze klant." : "Quiet. No situations for this customer."}</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {nl ? "Dat is de bedoeling. Mee spreekt pas als een regel echt matcht." : "That's the point. Mee only speaks when a rule really matches."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 min-[1440px]:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-4">
            <section className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={STATUS_STYLE[sit.status]}>{sit.status}</Badge>
                <h3 className="text-base font-semibold">{SITUATION_LABEL[sit.type][lang]}</h3>
                <code data-testid="agent-situation-id" className="ml-auto rounded bg-muted px-2 py-0.5 font-mono text-xs">{sit.id}</code>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">{nl ? "Regel" : "Rule"}</dt><dd className="font-mono">{RULES[sit.type].name}</dd>
                <dt className="text-muted-foreground">{nl ? "Geopend" : "Opened"}</dt><dd>{fmtTime(sit.createdAt, lang)}</dd>
                <dt className="text-muted-foreground">{nl ? "Verloopt" : "Expires"}</dt><dd>{fmtUntil(sit.expiresAt, lang)}</dd>
              </dl>
              <p className="mt-3 rounded-lg bg-muted/60 p-3 text-sm leading-relaxed">{RULES[sit.type].explain(sit.signals, lang)}</p>
            </section>

            <section className="@container rounded-2xl border bg-card p-4">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <Ban className="size-3.5" /> {nl ? "Al bekend · niet opnieuw vragen" : "Already known · don't re-ask"}
              </h4>
              <ul className="mt-2 grid gap-1.5 @min-[22rem]:grid-cols-2">
                {RULES[sit.type].knownFacts(sit.signals, lang).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />{f}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border bg-card p-4">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <MessageSquareQuote className="size-3.5" /> {nl ? "Readback · exact wat de klant zag" : "Readback · exactly what the customer saw"}
              </h4>
              <blockquote data-testid="agent-readback" className="mt-2 border-l-2 border-mee pl-3 text-[15px] leading-relaxed">
                {PLAYBOOKS[sit.type].app.scriptText[lang]}
              </blockquote>
              <VoiceButton situationId={sit.id} channel="app" label={nl ? "Lees voor aan klant" : "Read back to customer"} className="mt-3" />
            </section>

            <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-violet-700 uppercase">
                <Headphones className="size-3.5" /> {nl ? "Whisper · enkel voor de agent" : "Whisper · agent ear only"}
              </h4>
              <p className="mt-2 text-sm leading-relaxed">{PLAYBOOKS[sit.type].agent.scriptText[lang]}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">{PLAYBOOKS[sit.type].agent.version}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <VoiceButton situationId={sit.id} channel="agent" label={nl ? "Speel whisper" : "Play whisper"} />
                <Button disabled={sit.status !== "active"} onClick={() => act({ kind: "cta", situationId: sit.id, action: "agent_resolve" })}>
                  <CheckCircle2 /> {PLAYBOOKS[sit.type].agent.ctaLabel[lang]}
                </Button>
              </div>
            </section>
          </div>

          <section className="rounded-2xl border bg-card p-4">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <Clock className="size-3.5" /> {nl ? "Tijdlijn · één geheugen, alle kanalen" : "Timeline · one memory, every channel"}
            </h4>
            <ol className="mt-3 flex flex-col gap-3">
              {[...state.timeline].reverse().slice(0, 40).map((e) => (
                <li key={e.id} className={cn("flex gap-3 text-sm", e.situationId && e.situationId !== sit.id && "opacity-50")}>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", KIND_STYLE[e.kind])} />
                  <div className="min-w-0">
                    <p className="leading-snug">{e.text[lang]}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{fmtTime(e.at, lang)} · {e.kind}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}
