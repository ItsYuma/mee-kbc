export type Lang = "nl" | "en";
export type Localized = Record<Lang, string>;

export type SignalType =
  | "payment_declined"
  | "payment_succeeded"
  | "salary_received"
  | "rent_paid"
  | "balance_low"
  | "balance_recovered";

export type SignalPayload = {
  payment_declined: { merchant: string; amountEur: number; scheme: "Bancontact"; code: string; city: string };
  payment_succeeded: { merchant: string; amountEur: number; method: string };
  salary_received: { employer: string; amountEur: number };
  rent_paid: { payee: string; amountEur: number };
  balance_low: { balanceEur: number };
  balance_recovered: { balanceEur: number };
};

export type Signal = {
  [T in SignalType]: { id: string; type: T; timestamp: number; payload: SignalPayload[T] };
}[SignalType];

export type SituationType = "checkout_stuck" | "cash_stress";

export type SituationStatus = "active" | "resolved" | "dismissed" | "suppressed" | "expired";

export type Situation = {
  id: string;
  type: SituationType;
  customerId: string;
  status: SituationStatus;
  createdAt: number;
  expiresAt: number;
  closedAt?: number;
  signals: Signal[];
};

export type Channel = "app" | "agent";
export type Urgency = "time_critical" | "soft";

export type CtaAction =
  | "pay_with_payconiq"
  | "call_support"
  | "enable_buffer"
  | "not_now"
  | "dismiss_forever"
  | "agent_resolve";

export type PlaybookAction = {
  situationType: SituationType;
  channel: Channel;
  urgency: Urgency;
  version: string;
  title: Localized;
  scriptText: Localized;
  ctaLabel: Localized;
  ctaAction: CtaAction;
  secondary?: { ctaLabel: Localized; ctaAction: CtaAction }[];
};

export type Customer = {
  id: string;
  name: string;
  city: string;
  iban: string;
  balanceEur: number;
};

export type TimelineEntry = {
  id: string;
  at: number;
  situationId?: string;
  kind: "signal" | "situation" | "channel" | "privacy";
  text: Localized;
};

export type Prefs = {
  meePaused: boolean;
  pausedTypes: SituationType[];
  dismissedForever: SituationType[];
};

export type SupportCall = { situationId: string; startedAt: number };

export type MeeState = {
  customer: Customer;
  signals: Signal[];
  situations: Situation[];
  prefs: Prefs;
  marketingMutedUntil: number;
  supportCall: SupportCall | null;
  timeline: TimelineEntry[];
};

export type SignalInput = { [T in SignalType]: { type: T; payload: SignalPayload[T] } }[SignalType];

export type MeeCommand =
  | { kind: "signal"; signal: SignalInput }
  | { kind: "cta"; situationId: string; action: CtaAction }
  | { kind: "voice_played"; situationId: string; channel: Channel }
  | { kind: "why_opened"; situationId: string }
  | { kind: "pause_mee"; paused: boolean }
  | { kind: "pause_type"; situationType: SituationType; paused: boolean }
  | { kind: "tick" }
  | { kind: "reset" };
