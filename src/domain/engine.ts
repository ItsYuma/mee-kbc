import { RULES, eur, fill, type Slots } from "./rules";
import { AGENT_PLAYBOOKS, SITUATION_LABEL, VOICE_FLOWS } from "./playbooks";
import { matchChoice } from "./voice";
import type {
  AgentScript,
  Call,
  CtaAction,
  Lang,
  Localized,
  MeeCommand,
  MeeState,
  Signal,
  SignalInput,
  Situation,
  SituationStatus,
  SituationType,
  TimelineEntry,
  Turn,
  VoiceChoice,
} from "./types";

export type Ctx = { now: number; id: () => string };

const MARKETING_MUTE_MS = 72 * 60 * 60_000;
const MAX_MISSES = 2;
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
    call: null,
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

export function callSituation(state: MeeState): Situation | undefined {
  return state.call ? state.situations.find((s) => s.id === state.call!.situationId) : undefined;
}

export function liveCall(state: MeeState): Call | null {
  return state.call && state.call.phase !== "ended" ? state.call : null;
}

export const firstName = (state: MeeState) => state.customer.name.split(" ")[0];

export function situationSlots(state: MeeState, situation: Situation, lang: Lang): Slots {
  return { ...RULES[situation.type].slots(situation.signals, lang), name: firstName(state) };
}

export const NOT_UNDERSTOOD = "not_understood";

export function agentScript(state: MeeState, situation: Situation): AgentScript & { version: string } {
  const playbook = AGENT_PLAYBOOKS[situation.type];
  const reason = state.call?.situationId === situation.id ? state.call.handoffReason : undefined;
  return { ...playbook, ...(reason ? playbook.byHandoff?.[reason] : undefined) };
}

export function reduce(state: MeeState, cmd: MeeCommand, ctx: Ctx): MeeState {
  const s = expire(state, ctx);
  switch (cmd.kind) {
    case "signal":
      return ingest(s, cmd.signal, ctx);
    case "cta":
      return applyCta(s, cmd.situationId, cmd.action, cmd.lang, ctx);
    case "customer_said":
      return customerSaid(s, cmd.callId, cmd.text, cmd.source, ctx);
    case "end_call":
      return s.call?.id === cmd.callId && s.call.phase !== "ended"
        ? log(endCall(s, ctx), ctx, "channel", { en: "Customer hung up.", nl: "Klant hing op.", fr: "La cliente a raccroché." }, s.call.situationId)
        : s;
    case "voice_played":
      return log(s, ctx, "channel", cmd.channel === "app"
        ? { en: "Voice line played in app (approved script)", nl: "Spraakbericht afgespeeld in app (goedgekeurd script)", fr: "Message vocal lu dans l'app (script approuvé)" }
        : { en: "Agent whisper played (approved script)", nl: "Agent-whisper afgespeeld (goedgekeurd script)", fr: "Consigne lue au conseiller (script approuvé)" }, cmd.situationId);
    case "why_opened":
      return log(s, ctx, "privacy", {
        en: "Customer opened “Why am I seeing this?”",
        nl: "Klant opende “Waarom zie ik dit?”",
        fr: "La cliente a ouvert « Pourquoi je vois ceci ? »",
      }, cmd.situationId);
    case "pause_mee": {
      const paused = cmd.paused ? endCall(s, ctx) : s;
      return log(suppress({ ...paused, prefs: { ...paused.prefs, meePaused: cmd.paused } }, cmd.paused ? SITUATION_TYPES : [], ctx), ctx, "privacy", cmd.paused
        ? { en: "Customer paused Mee. No nudges on any channel.", nl: "Klant pauzeerde Mee. Geen nudges op geen enkel kanaal.", fr: "La cliente a mis Mee en pause. Plus aucune suggestion, sur aucun canal." }
        : { en: "Customer resumed Mee.", nl: "Klant hervatte Mee.", fr: "La cliente a réactivé Mee." });
    }
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
    (acc, sit) => log(close(acc, sit.id, "expired", ctx), ctx, "situation", { en: "Situation expired", nl: "Situatie verlopen", fr: "Situation expirée" }, sit.id),
    state,
  );
}

function close(state: MeeState, situationId: string, to: SituationStatus, ctx: Ctx): MeeState {
  const s: MeeState = {
    ...state,
    situations: state.situations.map((x) =>
      x.id === situationId && TRANSITIONS[x.status].includes(to) ? { ...x, status: to, closedAt: ctx.now } : x,
    ),
  };
  const call = liveCall(s);
  // A human agent stays on the line after a resolve so they can close the call themselves.
  const keepsCall = to === "resolved" && call?.phase === "with_agent";
  return call?.situationId === situationId && !keepsCall ? endCall(s, ctx) : s;
}

function endCall(state: MeeState, ctx: Ctx): MeeState {
  const call = liveCall(state);
  return call ? { ...state, call: { ...call, phase: "ended", endedAt: ctx.now } } : state;
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
      fr: `Résolu par le signal : ${signal.type}. Mee se fait discret.`,
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
      fr: `La règle a matché (${label.fr}), mais la cliente l'a mise en pause. Rien affiché.`,
    });
  }

  const situation: Situation = {
    id: `sit-${type.replaceAll("_", "-")}-${ctx.id().slice(0, 6)}`,
    type,
    customerId: state.customer.id,
    status: "active",
    createdAt: ctx.now,
    expiresAt: ctx.now + rule.ttlMs,
    signals: matched,
  };
  let s: MeeState = { ...state, situations: [...state.situations, situation] };
  s = log(s, ctx, "situation", {
    en: `Situation opened: ${label.en} (${rule.name})`,
    nl: `Situatie geopend: ${label.nl} (${rule.name})`,
    fr: `Situation ouverte : ${label.fr} (${rule.name})`,
  }, situation.id);
  if (type === "cash_stress") {
    s = log({ ...s, marketingMutedUntil: ctx.now + MARKETING_MUTE_MS }, ctx, "channel", {
      en: "Marketing muted for 72h on all channels",
      nl: "Marketing gedempt voor 72 u op alle kanalen",
      fr: "Marketing coupé pendant 72 h sur tous les canaux",
    }, situation.id);
  }
  return s;
}

function applyCta(state: MeeState, situationId: string, action: CtaAction, lang: Lang, ctx: Ctx): MeeState {
  const sit = state.situations.find((x) => x.id === situationId);
  if (!sit || sit.status !== "active") return state;
  switch (action) {
    case "pay_with_payconiq": {
      const decline = sit.signals.findLast((x) => x.type === "payment_declined");
      const payload = decline?.type === "payment_declined" ? decline.payload : { merchant: "merchant", amountEur: 0 };
      const s = log(state, ctx, "channel", { en: "Customer chose Payconiq", nl: "Klant koos Payconiq", fr: "La cliente a choisi Payconiq" }, sit.id);
      return ingest(s, { type: "payment_succeeded", payload: { merchant: payload.merchant, amountEur: payload.amountEur, method: "Payconiq" } }, ctx);
    }
    case "unblock_card": {
      const block = sit.signals.findLast((x) => x.type === "card_blocked");
      const card = block?.type === "card_blocked" ? block.payload.card : "••";
      const s = log(state, ctx, "channel", {
        en: "Customer confirmed the payment was hers",
        nl: "Klant bevestigde dat de betaling van haar was",
        fr: "La cliente a confirmé que le paiement venait d'elle",
      }, sit.id);
      return ingest(s, { type: "card_unblocked", payload: { card } }, ctx);
    }
    case "talk_to_mee":
      return startCall(state, sit, lang, ctx);
    case "enable_buffer":
      return log(close(state, sit.id, "resolved", ctx), ctx, "situation", {
        en: "Customer turned on the 48h buffer. Resolved.",
        nl: "Klant zette de 48u-buffer aan. Opgelost.",
        fr: "La cliente a activé la réserve 48 h. Résolu.",
      }, sit.id);
    case "not_now":
      return log(close(state, sit.id, "dismissed", ctx), ctx, "privacy", {
        en: "Customer said “Not now”. Cooldown started.",
        nl: "Klant zei “Nu niet”. Afkoelperiode gestart.",
        fr: "La cliente a dit « Pas maintenant ». Période de repos lancée.",
      }, sit.id);
    case "dismiss_forever":
      return log(
        { ...close(state, sit.id, "dismissed", ctx), prefs: { ...state.prefs, dismissedForever: [...state.prefs.dismissedForever, sit.type] } },
        ctx, "privacy",
        {
          en: `Customer dismissed “${SITUATION_LABEL[sit.type].en}” forever`,
          nl: `Klant verborg “${SITUATION_LABEL[sit.type].nl}” voorgoed`,
          fr: `La cliente a masqué « ${SITUATION_LABEL[sit.type].fr} » définitivement`,
        },
        sit.id,
      );
    case "agent_resolve":
      return log(endCall(close(state, sit.id, "resolved", ctx), ctx), ctx, "situation", {
        en: "Agent marked it fixed. No re-explaining needed.",
        nl: "Agent markeerde het als opgelost. Niets opnieuw uitgelegd.",
        fr: "Le conseiller a marqué la situation comme résolue. Rien à réexpliquer.",
      }, sit.id);
  }
}

function startCall(state: MeeState, sit: Situation, lang: Lang, ctx: Ctx): MeeState {
  if (liveCall(state)?.situationId === sit.id) return state;
  const call: Call = { id: `call-${ctx.id().slice(0, 8)}`, situationId: sit.id, lang, phase: "with_mee", startedAt: ctx.now, misses: 0, turns: [] };
  const s = meeSays({ ...endCall(state, ctx), call }, VOICE_FLOWS[sit.type].greeting, ctx);
  return log(s, ctx, "channel", {
    en: "Customer called Mee. Mee opened with the situation it already knows.",
    nl: "Klant belde Mee. Mee opende met de situatie die het al kent.",
    fr: "La cliente a appelé Mee. Mee a ouvert avec la situation qu'il connaît déjà.",
  }, sit.id);
}

function meeSays(state: MeeState, template: Localized, ctx: Ctx): MeeState {
  const call = state.call!;
  const sit = state.situations.find((x) => x.id === call.situationId)!;
  const turn: Turn = { id: ctx.id(), at: ctx.now, speaker: "mee", text: fill(template[call.lang], situationSlots(state, sit, call.lang)), source: "script" };
  return { ...state, call: { ...call, turns: [...call.turns, turn] } };
}

function customerSaid(state: MeeState, callId: string, text: string, source: "speech" | "quick_reply", ctx: Ctx): MeeState {
  const call = liveCall(state);
  const sit = callSituation(state);
  if (!call || call.id !== callId || !sit) return state;

  const flow = VOICE_FLOWS[sit.type];
  const choice = call.phase === "with_mee" ? matchChoice(text, call.lang, flow.choices) : null;
  const turn: Turn = { id: ctx.id(), at: ctx.now, speaker: "customer", text, source, matched: choice?.id ?? null };
  const s: MeeState = { ...state, call: { ...call, turns: [...call.turns, turn] } };
  if (call.phase === "with_agent") return s;

  if (choice) {
    const replied = log(meeSays(s, choice.reply, ctx), ctx, "channel", {
      en: `Answer recognised by keyword table: ${choice.id}`,
      nl: `Antwoord herkend via trefwoordentabel: ${choice.id}`,
      fr: `Réponse reconnue par la table de mots-clés : ${choice.id}`,
    }, sit.id);
    return applyEffect(replied, sit, choice, call.lang, ctx);
  }

  const misses = call.misses + 1;
  const missed: MeeState = { ...s, call: { ...s.call!, misses } };
  const logged = log(missed, ctx, "channel", {
    en: `Answer not recognised (${misses}/${MAX_MISSES})`,
    nl: `Antwoord niet herkend (${misses}/${MAX_MISSES})`,
    fr: `Réponse non reconnue (${misses}/${MAX_MISSES})`,
  }, sit.id);
  return misses >= MAX_MISSES ? handoff(logged, NOT_UNDERSTOOD, ctx) : meeSays(logged, flow.notUnderstood, ctx);
}

function applyEffect(state: MeeState, sit: Situation, choice: VoiceChoice, lang: Lang, ctx: Ctx): MeeState {
  switch (choice.effect.kind) {
    case "cta":
      return applyCta(state, sit.id, choice.effect.action, lang, ctx);
    case "handoff":
      return handoff(state, choice.id, ctx);
  }
}

function handoff(state: MeeState, reason: string, ctx: Ctx): MeeState {
  const sit = callSituation(state)!;
  const s = meeSays(state, VOICE_FLOWS[sit.type].handoff, ctx);
  return log({ ...s, call: { ...s.call!, phase: "with_agent", handedOffAt: ctx.now, handoffReason: reason } }, ctx, "channel", {
    en: "Mee handed the call to Anouk with the full situation.",
    nl: "Mee gaf het gesprek door aan Anouk, met de volledige situatie.",
    fr: "Mee a transféré l'appel à Anouk avec toute la situation.",
  }, sit.id);
}

function pauseType(state: MeeState, type: SituationType, paused: boolean, ctx: Ctx): MeeState {
  const pausedTypes = paused ? [...new Set([...state.prefs.pausedTypes, type])] : state.prefs.pausedTypes.filter((t) => t !== type);
  let s: MeeState = { ...state, prefs: { ...state.prefs, pausedTypes } };
  const active = activeSituation(s, type);
  s = suppress(s, paused ? [type] : [], ctx);
  const label = SITUATION_LABEL[type];
  return log(s, ctx, "privacy", paused
    ? { en: `Customer paused “${label.en}” only`, nl: `Klant pauzeerde enkel “${label.nl}”`, fr: `La cliente a mis en pause « ${label.fr} » uniquement` }
    : { en: `Customer resumed “${label.en}”`, nl: `Klant hervatte “${label.nl}”`, fr: `La cliente a réactivé « ${label.fr} »` }, active?.id);
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
    case "payment_succeeded":
      return balance - signal.payload.amountEur;
    case "balance_low":
    case "balance_recovered":
      return signal.payload.balanceEur;
    case "payment_declined":
    case "card_blocked":
    case "card_unblocked":
      return balance;
  }
}

export function describeSignal(sig: Signal): Localized {
  switch (sig.type) {
    case "payment_declined": {
      const { merchant, amountEur, code } = sig.payload;
      return {
        en: `Bancontact declined at ${merchant} · ${eur(amountEur, "en")} · code ${code}`,
        nl: `Bancontact geweigerd bij ${merchant} · ${eur(amountEur, "nl")} · code ${code}`,
        fr: `Bancontact refusé chez ${merchant} · ${eur(amountEur, "fr")} · code ${code}`,
      };
    }
    case "payment_succeeded": {
      const { merchant, amountEur, method } = sig.payload;
      return {
        en: `Paid ${eur(amountEur, "en")} at ${merchant} via ${method}`,
        nl: `${eur(amountEur, "nl")} betaald bij ${merchant} via ${method}`,
        fr: `${eur(amountEur, "fr")} payés chez ${merchant} via ${method}`,
      };
    }
    case "card_blocked": {
      const { card, merchant, amountEur, city, countryCode } = sig.payload;
      return {
        en: `Card ${card} blocked after ${eur(amountEur, "en")} at ${merchant}, ${city} (${countryCode})`,
        nl: `Kaart ${card} geblokkeerd na ${eur(amountEur, "nl")} bij ${merchant}, ${city} (${countryCode})`,
        fr: `Carte ${card} bloquée après ${eur(amountEur, "fr")} chez ${merchant}, ${city} (${countryCode})`,
      };
    }
    case "card_unblocked":
      return { en: `Card ${sig.payload.card} unblocked`, nl: `Kaart ${sig.payload.card} gedeblokkeerd`, fr: `Carte ${sig.payload.card} débloquée` };
    case "salary_received":
      return {
        en: `Salary in from ${sig.payload.employer} · ${eur(sig.payload.amountEur, "en")}`,
        nl: `Loon ontvangen van ${sig.payload.employer} · ${eur(sig.payload.amountEur, "nl")}`,
        fr: `Salaire reçu de ${sig.payload.employer} · ${eur(sig.payload.amountEur, "fr")}`,
      };
    case "rent_paid":
      return {
        en: `Rent out to ${sig.payload.payee} · ${eur(sig.payload.amountEur, "en")}`,
        nl: `Huur betaald aan ${sig.payload.payee} · ${eur(sig.payload.amountEur, "nl")}`,
        fr: `Loyer payé à ${sig.payload.payee} · ${eur(sig.payload.amountEur, "fr")}`,
      };
    case "balance_low":
      return {
        en: `Balance dipped to ${eur(sig.payload.balanceEur, "en")}`,
        nl: `Saldo gezakt tot ${eur(sig.payload.balanceEur, "nl")}`,
        fr: `Solde descendu à ${eur(sig.payload.balanceEur, "fr")}`,
      };
    case "balance_recovered":
      return {
        en: `Balance recovered to ${eur(sig.payload.balanceEur, "en")}`,
        nl: `Saldo hersteld tot ${eur(sig.payload.balanceEur, "nl")}`,
        fr: `Solde remonté à ${eur(sig.payload.balanceEur, "fr")}`,
      };
  }
}
