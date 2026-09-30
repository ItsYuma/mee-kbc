"use client";

import { useState } from "react";
import { CreditCard, Landmark, Play, RotateCcw, TrendingDown, TrendingUp, Home, CheckCircle2, XCircle, Zap, Plane, PhoneCall, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { activeSituation } from "@/domain/engine";
import { RULES } from "@/domain/rules";
import type { SignalInput, SituationType } from "@/domain/types";
import { COPY } from "./copy";
import { useMee, voiceKey } from "./provider";
import { Waveform } from "./voice-button";

const DECLINE: SignalInput = {
  type: "payment_declined",
  payload: { merchant: "Delhaize Korenmarkt", amountEur: 42.6, scheme: "Bancontact", code: "65", city: "Gent" },
};
const SALARY: SignalInput = { type: "salary_received", payload: { employer: "Studio Noord BV", amountEur: 2140 } };
const RENT: SignalInput = { type: "rent_paid", payload: { payee: "Immo Vandenbroucke", amountEur: 1150 } };
const LOW: SignalInput = { type: "balance_low", payload: { balanceEur: 84.3 } };
const RECOVER: SignalInput = { type: "balance_recovered", payload: { balanceEur: 412 } };
const CARD = "•• 4821";
const BLOCKED_ABROAD: SignalInput = {
  type: "card_blocked",
  payload: { card: CARD, merchant: "Pingo Doce Chiado", amountEur: 63.4, city: "Lisboa", countryCode: "PT", reason: "geo_velocity" },
};
const BLOCKED_HOME: SignalInput = {
  type: "card_blocked",
  payload: { card: CARD, merchant: "Delhaize Korenmarkt", amountEur: 42.6, city: "Gent", countryCode: "BE", reason: "geo_velocity" },
};
const UNBLOCKED: SignalInput = { type: "card_unblocked", payload: { card: CARD } };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Simulator() {
  const { state, now, lang, fire, act, speak, voice } = useMee();
  const t = COPY[lang].sim;
  const [busy, setBusy] = useState(false);

  const sequence = async (signals: SignalInput[]) => {
    setBusy(true);
    for (const [i, s] of signals.entries()) {
      if (i) await sleep(650);
      await fire(s);
    }
    setBusy(false);
  };

  const stuck = state && activeSituation(state, "checkout_stuck");
  const blocked = state && activeSituation(state, "card_blocked_abroad");
  const stress = state && activeSituation(state, "cash_stress");
  const recentDeclines = state?.signals.filter((s) => s.type === "payment_declined" && s.timestamp > now - RULES.checkout_stuck.windowMs).length ?? 0;
  const ivrPlaying = voice?.key === voiceKey({ kind: "classic_ivr", lang });
  const anyActive = stress ?? blocked ?? stuck;

  return (
    <div className="flex flex-col gap-5">
      <Section icon={<CreditCard className="size-4" />} title={t.j1} hint={t.j1Hint}>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" disabled={busy} onClick={() => fire(DECLINE)} className="h-auto justify-start py-2 text-left whitespace-normal">
            <XCircle className="text-destructive" /> {t.decline}
          </Button>
          <Button disabled={busy} onClick={() => sequence([DECLINE, DECLINE])} className="h-auto justify-start py-2 text-left whitespace-normal">
            <Zap /> {t.declineTwice}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t.declinesInWindow} <span className="font-mono text-foreground">{Math.min(recentDeclines, 9)}</span> / 2
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={!stuck || busy}
          onClick={() => fire({ type: "payment_succeeded", payload: { merchant: "Delhaize Korenmarkt", amountEur: 42.6, method: "Bancontact PIN" } })}
          className="justify-start"
        >
          <CheckCircle2 className="text-emerald-600" /> {t.resolveJ1}
        </Button>
      </Section>

      <Section icon={<Landmark className="size-4" />} title={t.j2} hint={t.j2Hint}>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => fire(SALARY)}>
            <TrendingUp /> {t.salary}
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => fire(RENT)}>
            <Home /> {t.rent}
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => fire(LOW)}>
            <TrendingDown /> {t.low}
          </Button>
        </div>
        <Button disabled={busy} onClick={() => sequence([SALARY, RENT, LOW])} className="justify-start">
          <Play /> {t.playPattern}
        </Button>
        <Button variant="ghost" size="sm" disabled={!stress || busy} onClick={() => fire(RECOVER)} className="justify-start">
          <CheckCircle2 className="text-emerald-600" /> {t.resolveJ2}
        </Button>
      </Section>

      <Section icon={<Plane className="size-4" />} title={t.j3} hint={t.j3Hint}>
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={busy} onClick={() => fire(BLOCKED_ABROAD)} className="h-auto justify-start py-2 text-left whitespace-normal">
            <Zap /> {t.blockAbroad}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => fire(BLOCKED_HOME)} className="h-auto justify-start py-2 text-left whitespace-normal">
            <ShieldQuestion /> {t.blockHome}
          </Button>
        </div>
        <Button variant="ghost" size="sm" disabled={!blocked || busy} onClick={() => fire(UNBLOCKED)} className="justify-start">
          <CheckCircle2 className="text-emerald-600" /> {t.resolveJ3}
        </Button>
      </Section>

      <Section icon={<PhoneCall className="size-4" />} title={t.contrast} hint={t.contrastHint}>
        <Button variant="outline" onClick={() => speak({ kind: "classic_ivr", lang })} className="justify-start">
          {ivrPlaying ? <Waveform /> : <Play />} {t.contrast}
        </Button>
      </Section>

      <Section title={t.shortcuts} hint={t.shortcutsHint}>
        <Button
          variant="outline"
          size="sm"
          disabled={!anyActive}
          onClick={() => anyActive && act({ kind: "cta", situationId: anyActive.id, action: anyActive.type === "cash_stress" ? "dismiss_forever" : "not_now", lang })}
          className="justify-start"
        >
          <XCircle /> {t.dismiss}
        </Button>
      </Section>

      <Section title={t.rules} hint={t.rulesHint}>
        <ul className="flex flex-col gap-2">
          {(Object.keys(RULES) as SituationType[]).map((type) => (
            <li key={type} className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
              <span className="font-mono text-[11px] leading-tight text-muted-foreground">{RULES[type].name}</span>
              <RuleStatus type={type} />
            </li>
          ))}
        </ul>
      </Section>

      <Button variant="ghost" size="sm" onClick={() => act({ kind: "reset" })} className="self-start text-muted-foreground">
        <RotateCcw /> {t.reset}
      </Button>
    </div>
  );
}

function RuleStatus({ type }: { type: SituationType }) {
  const { state, lang } = useMee();
  const t = COPY[lang].sim;
  if (!state) return null;
  if (state.prefs.dismissedForever.includes(type)) return <Badge variant="outline">{t.ruleDismissed}</Badge>;
  if (state.prefs.meePaused || state.prefs.pausedTypes.includes(type)) return <Badge variant="outline">{t.rulePaused}</Badge>;
  if (activeSituation(state, type)) return <Badge className="bg-mee-strong text-white">{t.ruleFiring}</Badge>;
  return <Badge variant="secondary">{t.ruleArmed}</Badge>;
}

function Section({ title, hint, icon, children }: { title: string; hint?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
