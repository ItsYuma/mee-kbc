"use client";

import { useState } from "react";
import { CreditCard, Landmark, Play, RotateCcw, TrendingDown, TrendingUp, Home, CheckCircle2, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { activeSituation } from "@/domain/engine";
import { RULES } from "@/domain/rules";
import type { SignalInput, SituationType } from "@/domain/types";
import { useMee } from "./provider";

const DECLINE: SignalInput = {
  type: "payment_declined",
  payload: { merchant: "Delhaize Korenmarkt", amountEur: 42.6, scheme: "Bancontact", code: "65", city: "Gent" },
};
const SALARY: SignalInput = { type: "salary_received", payload: { employer: "Studio Noord BV", amountEur: 2140 } };
const RENT: SignalInput = { type: "rent_paid", payload: { payee: "Immo Vandenbroucke", amountEur: 1150 } };
const LOW: SignalInput = { type: "balance_low", payload: { balanceEur: 84.3 } };
const RECOVER: SignalInput = { type: "balance_recovered", payload: { balanceEur: 412 } };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Simulator() {
  const { state, now, fire, act } = useMee();
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
  const stress = state && activeSituation(state, "cash_stress");
  const recentDeclines = state?.signals.filter((s) => s.type === "payment_declined" && s.timestamp > now - RULES.checkout_stuck.windowMs).length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <Section icon={<CreditCard className="size-4" />} title="Journey 1 · Payment fail" hint="2 Bancontact declines within 10 min">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" disabled={busy} onClick={() => fire(DECLINE)} className="h-auto justify-start py-2 text-left whitespace-normal">
            <XCircle className="text-destructive" /> Decline at Delhaize
          </Button>
          <Button disabled={busy} onClick={() => sequence([DECLINE, DECLINE])} className="h-auto justify-start py-2 text-left whitespace-normal">
            <Zap /> Fire decline ×2
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Declines in window: <span className="font-mono text-foreground">{Math.min(recentDeclines, 9)}</span> / 2
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={!stuck || busy}
          onClick={() => fire({ type: "payment_succeeded", payload: { merchant: "Delhaize Korenmarkt", amountEur: 42.6, method: "Bancontact PIN" } })}
          className="justify-start"
        >
          <CheckCircle2 className="text-emerald-600" /> Resolve: payment goes through
        </Button>
      </Section>

      <Section icon={<Landmark className="size-4" />} title="Journey 2 · Cash stress" hint="salary → rent → balance under €150">
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => fire(SALARY)}>
            <TrendingUp /> Salary
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => fire(RENT)}>
            <Home /> Rent
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => fire(LOW)}>
            <TrendingDown /> Low
          </Button>
        </div>
        <Button disabled={busy} onClick={() => sequence([SALARY, RENT, LOW])} className="justify-start">
          <Play /> Play full pattern
        </Button>
        <Button variant="ghost" size="sm" disabled={!stress || busy} onClick={() => fire(RECOVER)} className="justify-start">
          <CheckCircle2 className="text-emerald-600" /> Resolve: balance recovers
        </Button>
      </Section>

      <Section title="Customer shortcuts" hint="same as tapping in the app">
        <Button
          variant="outline"
          size="sm"
          disabled={!stuck && !stress}
          onClick={() => {
            const s = stress ?? stuck;
            if (s) act({ kind: "cta", situationId: s.id, action: s.type === "cash_stress" ? "dismiss_forever" : "not_now" });
          }}
          className="justify-start"
        >
          <XCircle /> Dismiss active situation
        </Button>
      </Section>

      <Section title="Rules watching" hint="deterministic, versioned, no model">
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
        <RotateCcw /> Reset demo
      </Button>
    </div>
  );
}

function RuleStatus({ type }: { type: SituationType }) {
  const { state } = useMee();
  if (!state) return null;
  if (state.prefs.dismissedForever.includes(type)) return <Badge variant="outline">dismissed ∞</Badge>;
  if (state.prefs.meePaused || state.prefs.pausedTypes.includes(type)) return <Badge variant="outline">paused</Badge>;
  if (activeSituation(state, type)) return <Badge className="bg-mee-strong text-white">firing</Badge>;
  return <Badge variant="secondary">armed</Badge>;
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
