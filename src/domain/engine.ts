import { RULES } from "./rules";
import { SITUATION_LABEL } from "./playbooks";
import type {
  CtaAction,
  Localized,
  MeeCommand,
  MeeState,
  Signal,
  SignalInput,
  Situation,
  SituationStatus,
  SituationType,
  TimelineEntry,
} from "./types";

export type Ctx = { now: number; id: () => string };

const MARKETING_MUTE_MS = 72 * 60 * 60_000;
const SITUATION_TYPES = Object.keys(RULES) as SituationType[];

const TRANSITIONS: Record<SituationStatus, SituationStatus[]> = {
  active: ["resolved", "dismissed", "suppressed", "expired"],
  resolved: [],
  dismissed: [],
  suppressed: [],
  expired: [],
};

export const DEMO_CUSTOMER = {
  id: "cust-lotte-001",
  name: "Lotte Peeters",
  city: "Gent",
  iban: "BE71 0961 2345 6769",
  balanceEur: 1284.5,
};

export function initialState(): MeeState {
  return {
    customer: { ...DEMO_CUSTOMER },
    signals: [],
    situations: [],
    prefs: { meePaused: false, pausedTypes: [], dismissedForever: [] },
    marketingMutedUntil: 0,
    supportCall: null,
    timeline: [],
  };
}

export function activeSituation(state: MeeState, type?: SituationType): Situation | undefined {
  return state.situations.findLast((s) => s.status === "active" && (!type || s.type === type));
}

export function customerVisibleSituation(state: MeeState): Situation | undefined {
  if (state.prefs.meePaused) return undefined;
  return activeSituation(state);
}

export function agentSituation(state: MeeState): Situation | undefined {
  const called = state.supportCall && state.situations.find((s) => s.id === state.supportCall!.situationId);
  return called || activeSituation(state) || state.situations.at(-1);
}

export function reduce(state: MeeState, cmd: MeeCommand, ctx: Ctx): MeeState {
  const s = expire(state, ctx);
  switch (cmd.kind) {
    case "signal":
      return ingest(s, cmd.signal, ctx);
    case "cta":
      return applyCta(s, cmd.situationId, cmd.action, ctx);
    case "voice_played":
      return log(s, ctx, "channel", cmd.channel === "app"
        ? { en: "Voice line played in app (approved script)", nl: "Spraakbericht afgespeeld in app (goedgekeurd script)" }
        : { en: "Agent whisper played (approved script)", nl: "Agent-whisper afgespeeld (goedgekeurd script)" }, cmd.situationId);
    case "why_opened":
      return log(s, ctx, "privacy", { en: "Customer opened “Why am I seeing this?”", nl: "Klant opende “Waarom zie ik dit?”" }, cmd.situationId);
    case "pause_mee":
      return log(suppress({ ...s, prefs: { ...s.prefs, meePaused: cmd.paused } }, cmd.paused ? SITUATION_TYPES : [], ctx), ctx, "privacy", cmd.paused
        ? { en: "Customer paused Mee. No nudges on any channel.", nl: "Klant pauzeerde Mee. Geen nudges op geen enkel kanaal." }
        : { en: "Customer resumed Mee.", nl: "Klant hervatte Mee." });
    case "pause_type":
      return pauseType(s, cmd.situationType, cmd.paused, ctx);
    case "tick":
      return s;
    case "reset":
      return initialState();
  }
}

function expire(state: MeeState, ctx: Ctx): MeeState {
  const stale = state.situations.filter((s) => s.status === "active" && s.expiresAt <= ctx.now);
  return stale.reduce(
    (acc, sit) => log(close(acc, sit.id, "expired", ctx), ctx, "situation", { en: "Situation expired", nl: "Situatie verlopen" }, sit.id),
    state,
  );
}

function close(state: MeeState, situationId: string, to: SituationStatus, ctx: Ctx): MeeState {
  return {
    ...state,
    situations: state.situations.map((s) =>
      s.id === situationId && TRANSITIONS[s.status].includes(to) ? { ...s, status: to, closedAt: ctx.now } : s,
    ),
    supportCall: state.supportCall?.situationId === situationId && to !== "resolved" ? null : state.supportCall,
  };
}

function log(state: MeeState, ctx: Ctx, kind: TimelineEntry["kind"], text: Localized, situationId?: string): MeeState {
  return { ...state, timeline: [...state.timeline, { id: ctx.id(), at: ctx.now, kind, text, situationId }] };
}

function ingest(state: MeeState, input: SignalInput, ctx: Ctx): MeeState {
  const signal = { ...input, id: ctx.id(), timestamp: ctx.now } as Signal;
  let s: MeeState = {
    ...state,
    signals: [...state.signals, signal],
    customer: { ...state.customer, balanceEur: nextBalance(state.customer.balanceEur, signal) },
  };
  s = log(s, ctx, "signal", describeSignal(signal));

  for (const sit of s.situations.filter((x) => x.status === "active" && RULES[x.type].resolvesOn.includes(signal.type))) {
    s = log(close(s, sit.id, "resolved", ctx), ctx, "situation", {
      en: `Resolved by signal: ${signal.type}. Mee goes quiet.`,
      nl: `Opgelost door signaal: ${signal.type}. Mee wordt stil.`,
    }, sit.id);
  }

  for (const type of SITUATION_TYPES) s = evaluate(s, type, ctx);
  return s;
}

function evaluate(state: MeeState, type: SituationType, ctx: Ctx): MeeState {
  const rule = RULES[type];
  if (activeSituation(state, type) || state.prefs.dismissedForever.includes(type)) return state;

  const lastClosed = state.situations.findLast((x) => x.type === type && x.closedAt !== undefined);
  if (lastClosed?.status === "dismissed" && lastClosed.closedAt! + rule.dismissCooldownMs > ctx.now) return state;

  const since = Math.max(ctx.now - rule.windowMs, lastClosed?.closedAt ?? -Infinity);
  const matched = rule.match(state.signals.filter((x) => x.timestamp >= since));
  if (!matched) return state;

  const label = SITUATION_LABEL[type];
  if (state.prefs.meePaused || state.prefs.pausedTypes.includes(type)) {
    return log(state, ctx, "privacy", {
      en: `Rule matched (${label.en}), but the customer paused it. Nothing shown.`,
      nl: `Regel matchte (${label.nl}), maar de klant pauzeerde dit. Niets getoond.`,
    });
  }

  const situation: Situation = {
    id: `sit-${type.replace("_", "-")}-${ctx.id().slice(0, 6)}`,
    type,
    customerId: state.customer.id,
    status: "active",
    createdAt: ctx.now,
    expiresAt: ctx.now + rule.ttlMs,
    signals: matched,
  };
  let s: MeeState = { ...state, situations: [...state.situations, situation] };
  s = log(s, ctx, "situation", { en: `Situation opened: ${label.en} (${rule.name})`, nl: `Situatie geopend: ${label.nl} (${rule.name})` }, situation.id);
  if (type === "cash_stress") {
    s = log({ ...s, marketingMutedUntil: ctx.now + MARKETING_MUTE_MS }, ctx, "channel", {
      en: "Marketing muted for 72h on all channels",
      nl: "Marketing gedempt voor 72 u op alle kanalen",
    }, situation.id);
  }
  return s;
}

function applyCta(state: MeeState, situationId: string, action: CtaAction, ctx: Ctx): MeeState {
  const sit = state.situations.find((x) => x.id === situationId);
  if (!sit || sit.status !== "active") return state;
  switch (action) {
    case "pay_with_payconiq": {
      const decline = sit.signals.findLast((x) => x.type === "payment_declined");
      const payload = decline?.type === "payment_declined" ? decline.payload : { merchant: "merchant", amountEur: 0 };
      const s = log(state, ctx, "channel", { en: "Customer tapped “Pay with Payconiq”", nl: "Klant tikte “Betaal met Payconiq”" }, sit.id);
      return ingest(s, { type: "payment_succeeded", payload: { merchant: payload.merchant, amountEur: payload.amountEur, method: "Payconiq" } }, ctx);
    }
    case "call_support":
      return log({ ...state, supportCall: { situationId, startedAt: ctx.now } }, ctx, "channel", {
        en: "Customer called support. Agent desk opened with this situation.",
        nl: "Klant belde support. Agent ziet deze situatie meteen.",
      }, sit.id);
    case "enable_buffer":
      return log(close(state, sit.id, "resolved", ctx), ctx, "situation", {
        en: "Customer turned on the 48h buffer. Resolved.",
        nl: "Klant zette de 48u-buffer aan. Opgelost.",
      }, sit.id);
    case "not_now":
      return log(close(state, sit.id, "dismissed", ctx), ctx, "privacy", {
        en: "Customer tapped “Not now”. Cooldown started.",
        nl: "Klant tikte “Nu niet”. Afkoelperiode gestart.",
      }, sit.id);
    case "dismiss_forever":
      return log(
        { ...close(state, sit.id, "dismissed", ctx), prefs: { ...state.prefs, dismissedForever: [...state.prefs.dismissedForever, sit.type] } },
        ctx, "privacy",
        { en: `Customer dismissed “${SITUATION_LABEL[sit.type].en}” forever`, nl: `Klant verborg “${SITUATION_LABEL[sit.type].nl}” voorgoed` },
        sit.id,
      );
    case "agent_resolve":
      return log({ ...close(state, sit.id, "resolved", ctx), supportCall: null }, ctx, "situation", {
        en: "Agent marked it fixed. No re-explaining needed.",
        nl: "Agent markeerde het als opgelost. Niets opnieuw uitgelegd.",
      }, sit.id);
  }
}

function pauseType(state: MeeState, type: SituationType, paused: boolean, ctx: Ctx): MeeState {
  const pausedTypes = paused ? [...new Set([...state.prefs.pausedTypes, type])] : state.prefs.pausedTypes.filter((t) => t !== type);
  let s: MeeState = { ...state, prefs: { ...state.prefs, pausedTypes } };
  const active = activeSituation(s, type);
  s = suppress(s, paused ? [type] : [], ctx);
  return log(s, ctx, "privacy", paused
    ? { en: `Customer paused “${SITUATION_LABEL[type].en}” only`, nl: `Klant pauzeerde enkel “${SITUATION_LABEL[type].nl}”` }
    : { en: `Customer resumed “${SITUATION_LABEL[type].en}”`, nl: `Klant hervatte “${SITUATION_LABEL[type].nl}”` }, active?.id);
}

function suppress(state: MeeState, types: SituationType[], ctx: Ctx): MeeState {
  return state.situations
    .filter((x) => x.status === "active" && types.includes(x.type))
    .reduce((acc, sit) => close(acc, sit.id, "suppressed", ctx), state);
}

function nextBalance(balance: number, signal: Signal): number {
  switch (signal.type) {
    case "salary_received":
      return balance + signal.payload.amountEur;
    case "rent_paid":
      return balance - signal.payload.amountEur;
    case "balance_low":
    case "balance_recovered":
      return signal.payload.balanceEur;
    case "payment_succeeded":
      return balance - signal.payload.amountEur;
    case "payment_declined":
      return balance;
  }
}

const eur = (n: number) => `€${n.toFixed(2)}`;

export function describeSignal(sig: Signal): Localized {
  switch (sig.type) {
    case "payment_declined":
      return {
        en: `Bancontact declined at ${sig.payload.merchant} · ${eur(sig.payload.amountEur)} · code ${sig.payload.code}`,
        nl: `Bancontact geweigerd bij ${sig.payload.merchant} · ${eur(sig.payload.amountEur)} · code ${sig.payload.code}`,
      };
    case "payment_succeeded":
      return {
        en: `Paid ${eur(sig.payload.amountEur)} at ${sig.payload.merchant} via ${sig.payload.method}`,
        nl: `${eur(sig.payload.amountEur)} betaald bij ${sig.payload.merchant} via ${sig.payload.method}`,
      };
    case "salary_received":
      return { en: `Salary in from ${sig.payload.employer} · ${eur(sig.payload.amountEur)}`, nl: `Loon ontvangen van ${sig.payload.employer} · ${eur(sig.payload.amountEur)}` };
    case "rent_paid":
      return { en: `Rent out to ${sig.payload.payee} · ${eur(sig.payload.amountEur)}`, nl: `Huur betaald aan ${sig.payload.payee} · ${eur(sig.payload.amountEur)}` };
    case "balance_low":
      return { en: `Balance dipped to ${eur(sig.payload.balanceEur)}`, nl: `Saldo gezakt tot ${eur(sig.payload.balanceEur)}` };
    case "balance_recovered":
      return { en: `Balance recovered to ${eur(sig.payload.balanceEur)}`, nl: `Saldo hersteld tot ${eur(sig.payload.balanceEur)}` };
  }
}
