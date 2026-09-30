"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownLeft, ArrowUpRight, BellOff, ChevronRight, CreditCard, Home, Info, LayoutGrid, LockOpen, PauseCircle, Phone, PiggyBank, Send, ShieldCheck, Sparkles, X, XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { callSituation, customerVisibleSituation, describeSignal } from "@/domain/engine";
import { APP_PLAYBOOKS, SITUATION_LABEL } from "@/domain/playbooks";
import { NOT_USED, RULES, explainSituation } from "@/domain/rules";
import type { CtaAction, Lang, Signal, Situation, SituationType } from "@/domain/types";
import { CallScreen, ENDED_CARD_MS } from "./call-screen";
import { COPY, fmtEur, fmtTime, fmtUntil } from "./copy";
import { useMee } from "./provider";
import { VoiceButton } from "./voice-button";

type Panel = { kind: "why"; situationId: string } | { kind: "settings" } | null;

const CTA_ICON: Record<CtaAction, LucideIcon | null> = {
  pay_with_payconiq: Sparkles,
  unblock_card: LockOpen,
  enable_buffer: PiggyBank,
  talk_to_mee: Phone,
  not_now: null,
  dismiss_forever: XCircle,
  agent_resolve: null,
};

const CTA_TOAST: Record<CtaAction, "resolvedToast" | "notNowToast" | "dismissedToast" | null> = {
  pay_with_payconiq: "resolvedToast",
  unblock_card: "resolvedToast",
  enable_buffer: "resolvedToast",
  talk_to_mee: null,
  not_now: "notNowToast",
  dismiss_forever: "dismissedToast",
  agent_resolve: null,
};

export function CustomerApp({ autoVoice = true }: { autoVoice?: boolean }) {
  const { state, now, lang, act, speakOnce, error } = useMee();
  const [panel, setPanel] = useState<Panel>(null);
  const [closedCallId, setClosedCallId] = useState<string | null>(null);
  const t = COPY[lang].customer;

  const situation = state ? customerVisibleSituation(state) : undefined;
  const action = situation && APP_PLAYBOOKS[situation.type];
  const timeCritical = action?.urgency === "time_critical";
  const situationId = situation?.id;
  const call = state?.call ?? null;
  const callSit = state ? callSituation(state) : undefined;
  const showCall =
    !!call && !!callSit && call.id !== closedCallId && (call.phase !== "ended" || (call.endedAt !== undefined && now - call.endedAt < ENDED_CARD_MS));
  const inCall = !!call && call.phase !== "ended";

  useEffect(() => {
    if (autoVoice && situationId && timeCritical && !inCall) speakOnce({ kind: "situation", situationId, channel: "app", lang });
  }, [autoVoice, situationId, timeCritical, inCall, lang, speakOnce]);

  const openWhy = (sit: Situation) => {
    setPanel({ kind: "why", situationId: sit.id });
    act({ kind: "why_opened", situationId: sit.id });
  };

  if (!state) {
    return (
      <div className="flex h-full flex-col gap-3 p-5">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        <div className="h-16 animate-pulse rounded-xl bg-muted" />
        <div className="h-16 animate-pulse rounded-xl bg-muted" />
        {error && <p className="text-sm text-destructive">{t.unreachable(error)}</p>}
      </div>
    );
  }

  const onCta = async (sit: Situation, a: CtaAction) => {
    await act({ kind: "cta", situationId: sit.id, action: a, lang });
    const key = CTA_TOAST[a];
    if (key) toast.success(t[key]);
  };

  const muted = state.marketingMutedUntil > now;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-background">
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <p className="text-xs text-muted-foreground">Mee · demo bank</p>
          <h1 className="text-lg font-semibold tracking-tight">{t.greeting}</h1>
        </div>
        <button
          type="button"
          onClick={() => setPanel({ kind: "settings" })}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            state.prefs.meePaused ? "border-dashed text-muted-foreground" : "border-mee/40 bg-mee-soft text-ink",
          )}
        >
          <span className={cn("size-2 rounded-full", state.prefs.meePaused ? "bg-muted-foreground" : "bg-mee")} />
          {state.prefs.meePaused ? t.meePaused : t.meeOn}
        </button>
      </header>

      {state.prefs.meePaused && (
        <div className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-2"><PauseCircle className="size-4" /> {t.pausedBanner}</span>
          <Button size="xs" variant="outline" onClick={() => act({ kind: "pause_mee", paused: false })}>{t.resume}</Button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <section className="rounded-2xl bg-ink p-5 text-white shadow-lg shadow-ink/20">
          <div className="flex items-center justify-between text-xs text-white/70">
            <span>{t.checking}</span>
            <span className="font-mono">{state.customer.iban}</span>
          </div>
          <p className="mt-4 text-xs text-white/70">{t.available}</p>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{fmtEur(state.customer.balanceEur, lang)}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            {[{ i: Send, l: t.pay }, { i: CreditCard, l: t.cards }, { i: LayoutGrid, l: t.more }].map(({ i: I, l }) => (
              <span key={l} className="flex items-center justify-center gap-1.5 rounded-lg bg-white/10 py-2"><I className="size-3.5" />{l}</span>
            ))}
          </div>
        </section>

        {situation && action && !timeCritical && (
          <div className="mt-4 animate-[mee-rise_0.35s_ease-out]">
            <SituationCard situation={situation} onCta={onCta} onWhy={() => openWhy(situation)} />
          </div>
        )}

        <div className="mt-4">
          {muted ? (
            <div className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-xs text-muted-foreground">
              <BellOff className="size-4 shrink-0" /> {t.marketingMuted}
              <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">{t.muted}</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><PiggyBank className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.promoTitle}</p>
                <p className="text-xs text-muted-foreground">{t.promoBody}</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          )}
        </div>

        <h2 className="mt-6 mb-2 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t.recent}</h2>
        <ul className="divide-y rounded-xl border bg-card">
          {[...state.signals].reverse().map((s) => <ActivityRow key={s.id} signal={s} />)}
          {[
            { label: "Bakkerij Van Hecke", amount: -6.4, when: t.yesterday },
            { label: "De Lijn", amount: -2.5, when: t.yesterday },
            { label: "Colruyt Gent", amount: -38.12, when: t.monday },
          ].map((tx) => (
            <li key={tx.label} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-muted"><ArrowUpRight className="size-4 text-muted-foreground" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{tx.label}</p>
                <p className="text-xs text-muted-foreground">{tx.when}</p>
              </div>
              <span className="text-sm tabular-nums">{fmtEur(tx.amount, lang)}</span>
            </li>
          ))}
        </ul>
        {state.signals.length === 0 && <p className="mt-3 px-1 text-xs text-muted-foreground">{t.noActivity}</p>}
      </div>

      <nav className="flex shrink-0 justify-around border-t bg-background/95 px-4 pt-2 pb-5 text-[11px] text-muted-foreground backdrop-blur">
        {[{ i: Home, l: t.home, on: true }, { i: Send, l: t.pay }, { i: CreditCard, l: t.cards }, { i: LayoutGrid, l: t.more }].map(({ i: I, l, on }) => (
          <span key={l} className={cn("flex flex-col items-center gap-0.5", on && "text-ink font-medium")}><I className="size-5" />{l}</span>
        ))}
      </nav>

      {situation && action && timeCritical && (
        <>
          <div className="absolute inset-x-3 top-3 z-20 flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-xl ring-1 ring-black/5 backdrop-blur animate-[mee-drop_0.3s_ease-out]">
            <span className="flex size-8 items-center justify-center rounded-lg bg-mee text-white"><Sparkles className="size-4" /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-mee-strong">{t.meeNow}</p>
              <p className="truncate text-sm font-medium">{action.title[lang]}</p>
            </div>
          </div>
          <div className="absolute inset-0 z-10 bg-ink/30 backdrop-blur-[2px]" />
          <div className="absolute inset-x-0 bottom-0 z-20 max-h-[calc(100%-4.5rem)] overflow-y-auto animate-[mee-rise_0.35s_ease-out] p-3">
            <SituationCard situation={situation} onCta={onCta} onWhy={() => openWhy(situation)} elevated />
          </div>
        </>
      )}

      <Overlay open={panel?.kind === "why" && panel.situationId === situation?.id} onClose={() => setPanel(null)} title={t.whyTitle}>
        {situation && <WhyContent situation={situation} />}
      </Overlay>
      <Overlay open={panel?.kind === "settings"} onClose={() => setPanel(null)} title={t.settings}>
        <SettingsContent situation={situation} />
      </Overlay>

      {showCall && <CallScreen call={call} situation={callSit} onClose={() => setClosedCallId(call.id)} />}
    </div>
  );
}

function SituationCard({ situation, onCta, onWhy, elevated }: { situation: Situation; onCta: (s: Situation, a: CtaAction) => void; onWhy: () => void; elevated?: boolean }) {
  const { lang, act } = useMee();
  const t = COPY[lang].customer;
  const action = APP_PLAYBOOKS[situation.type];
  const PrimaryIcon = CTA_ICON[action.ctaAction];

  return (
    <article
      data-testid="situation-card"
      data-situation={situation.type}
      className={cn("rounded-2xl border bg-card p-4", elevated ? "shadow-2xl ring-1 ring-black/5" : "border-mee/30 bg-gradient-to-b from-mee-soft to-card")}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-mee-strong"><Sparkles className="size-3.5" /> {t.meeBecause}</p>
        <button type="button" onClick={() => act({ kind: "pause_type", situationType: situation.type, paused: true })} className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground">
          <PauseCircle className="size-3.5" /> {t.pauseThis}
        </button>
      </div>
      <h3 className="mt-2 text-lg font-semibold tracking-tight">{action.title[lang]}</h3>
      <p className="mt-1 text-sm leading-relaxed text-foreground/80">{action.scriptText[lang]}</p>
      <VoiceButton request={{ kind: "situation", situationId: situation.id, channel: "app", lang }} className="mt-3" />
      <div className="mt-4 flex flex-col gap-2">
        <Button size="lg" className="h-11 text-sm" onClick={() => onCta(situation, action.ctaAction)}>
          {PrimaryIcon && <PrimaryIcon />} {action.ctaLabel[lang]}
        </Button>
        {action.secondary && (
          <div className="flex gap-2">
            {action.secondary.map((s) => {
              const Icon = CTA_ICON[s.ctaAction];
              return (
                <Button key={s.ctaAction} variant="outline" className="h-10 flex-1" onClick={() => onCta(situation, s.ctaAction)}>
                  {Icon && <Icon />}
                  {s.ctaLabel[lang]}
                </Button>
              );
            })}
          </div>
        )}
      </div>
      <button type="button" onClick={onWhy} className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-ink underline-offset-4 hover:underline">
        <Info className="size-3.5" /> {t.why}
      </button>
    </article>
  );
}

function WhyContent({ situation }: { situation: Situation }) {
  const { lang } = useMee();
  const t = COPY[lang].customer;
  const rule = RULES[situation.type];
  const action = APP_PLAYBOOKS[situation.type];

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t.weNoticed}</h4>
        <p className="mt-1.5 text-[15px] leading-relaxed">{explainSituation(situation.type, situation.signals, lang)}</p>
      </section>
      <section>
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t.signalsUsed}</h4>
        <ul className="mt-2 flex flex-col gap-1.5">
          {situation.signals.map((s) => (
            <li key={s.id} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 font-mono text-[11px] text-muted-foreground">{fmtTime(s.timestamp, lang)}</span>
              <span>{describeSignal(s)[lang]}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t.neverUsed}</h4>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {NOT_USED[lang].map((n) => (
            <li key={n} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground line-through decoration-muted-foreground/40">{n}</li>
          ))}
        </ul>
      </section>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-muted/60 p-3 text-xs">
        <dt className="text-muted-foreground">{t.ruleLabel}</dt><dd className="font-mono">{rule.name}</dd>
        <dt className="text-muted-foreground">{t.playbookLabel}</dt><dd className="font-mono">{action.version}</dd>
        <dt className="text-muted-foreground">{t.expires}</dt><dd>{fmtUntil(situation.expiresAt, lang)}</dd>
      </dl>
      <Separator />
      <PrivacyControls situationType={situation.type} />
    </div>
  );
}

function SettingsContent({ situation }: { situation?: Situation }) {
  const { state, lang } = useMee();
  const t = COPY[lang].customer;
  if (!state) return null;
  return (
    <div className="flex flex-col gap-5">
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        {t.settingsIntro}
      </p>
      <PrivacyControls situationType={situation?.type} allTypes />
      <div>
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t.dismissedForever}</h4>
        <p className="mt-1 text-sm">{state.prefs.dismissedForever.map((d) => SITUATION_LABEL[d][lang]).join(", ") || t.none}</p>
      </div>
    </div>
  );
}

function PrivacyControls({ situationType, allTypes }: { situationType?: SituationType; allTypes?: boolean }) {
  const { state, lang, act } = useMee();
  const t = COPY[lang].customer;
  if (!state) return null;
  const types = allTypes ? (Object.keys(RULES) as SituationType[]) : situationType ? [situationType] : [];
  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t.privacy}</h4>
      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-medium">{t.pauseMee}</span>
          <span className="block text-xs text-muted-foreground">{t.pauseMeeHint}</span>
        </span>
        <Switch checked={state.prefs.meePaused} onCheckedChange={(v) => act({ kind: "pause_mee", paused: v })} aria-label={t.pauseMee} />
      </label>
      {types.map((type) => (
        <label key={type} className="flex items-center justify-between gap-4">
          <span className="text-sm">{allTypes ? t.pauseNamed(SITUATION_LABEL[type][lang]) : t.pauseType}</span>
          <Switch
            checked={state.prefs.pausedTypes.includes(type)}
            onCheckedChange={(v) => act({ kind: "pause_type", situationType: type, paused: v })}
            aria-label={`${t.pauseType} ${SITUATION_LABEL[type][lang]}`}
          />
        </label>
      ))}
    </section>
  );
}

function Overlay({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { lang } = useMee();
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end" role="dialog" aria-modal aria-label={title}>
      <button type="button" aria-label={COPY[lang].customer.close} className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative max-h-[88%] overflow-y-auto rounded-t-3xl bg-background p-5 pb-8 shadow-2xl animate-[mee-rise_0.3s_ease-out]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={COPY[lang].customer.close}><X /></Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ActivityRow({ signal }: { signal: Signal }) {
  const { lang } = useMee();
  const view = activityView(signal, lang);
  if (!view) return null;
  return (
    <li className="flex items-center gap-3 px-4 py-3 animate-[mee-drop_0.25s_ease-out]">
      <span className={cn("flex size-8 items-center justify-center rounded-full", view.tone === "bad" ? "bg-red-50 text-red-600" : view.tone === "in" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground")}>
        {view.tone === "in" ? <ArrowDownLeft className="size-4" /> : view.tone === "bad" ? <XCircle className="size-4" /> : <ArrowUpRight className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{view.label}</p>
        <p className="text-xs text-muted-foreground">{view.sub} · {fmtTime(signal.timestamp, lang)}</p>
      </div>
      <span className={cn("text-sm tabular-nums", view.tone === "bad" && "text-muted-foreground line-through", view.tone === "in" && "text-emerald-700")}>
        {fmtEur(view.amount, lang)}
      </span>
    </li>
  );
}

function activityView(s: Signal, lang: Lang): { label: string; sub: string; amount: number; tone: "in" | "out" | "bad" } | null {
  const t = COPY[lang].customer;
  switch (s.type) {
    case "payment_declined":
      return { label: s.payload.merchant, sub: t.declined, amount: -s.payload.amountEur, tone: "bad" };
    case "payment_succeeded":
      return { label: s.payload.merchant, sub: s.payload.method, amount: -s.payload.amountEur, tone: "out" };
    case "card_blocked":
      return { label: s.payload.merchant, sub: t.cardBlocked(s.payload.city), amount: -s.payload.amountEur, tone: "bad" };
    case "salary_received":
      return { label: s.payload.employer, sub: t.salary, amount: s.payload.amountEur, tone: "in" };
    case "rent_paid":
      return { label: s.payload.payee, sub: t.rent, amount: -s.payload.amountEur, tone: "out" };
    case "card_unblocked":
    case "balance_low":
    case "balance_recovered":
      return null;
  }
}
