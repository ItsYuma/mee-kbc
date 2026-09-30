export const LANGS = ["nl", "fr", "en"] as const;
export type Lang = (typeof LANGS)[number];
export type Localized = Record<Lang, string>;

export type SignalType =
  | "payment_declined"
  | "payment_succeeded"
  | "card_blocked"
  | "card_unblocked"
  | "salary_received"
  | "rent_paid"
  | "balance_low"
  | "balance_recovered";

export type SignalPayload = {
  payment_declined: { merchant: string; amountEur: number; scheme: "Bancontact"; code: string; city: string };
  payment_succeeded: { merchant: string; amountEur: number; method: string };
  card_blocked: { card: string; merchant: string; amountEur: number; city: string; countryCode: string; reason: string };
  card_unblocked: { card: string };
  salary_received: { employer: string; amountEur: number };
  rent_paid: { payee: string; amountEur: number };
  balance_low: { balanceEur: number };
  balance_recovered: { balanceEur: number };
};

export type Signal = {
  [T in SignalType]: { id: string; type: T; timestamp: number; payload: SignalPayload[T] };
}[SignalType];

export type SituationType = "checkout_stuck" | "card_blocked_abroad" | "cash_stress";

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
  | "unblock_card"
  | "enable_buffer"
  | "talk_to_mee"
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

export type AgentScript = {
  whisper: Localized;
  recommended: Localized;
  ctaLabel: Localized;
};

export type HandoffReason = string;

export type AgentPlaybook = AgentScript & {
  version: string;
  byHandoff?: Record<HandoffReason, AgentScript>;
};

export type VoiceEffect = { kind: "cta"; action: CtaAction } | { kind: "handoff" };

export type VoiceChoice = {
  id: string;
  keywords: Record<Lang, string[]>;
  quickReply: Localized;
  reply: Localized;
  effect: VoiceEffect;
};

export type VoiceFlow = {
  version: string;
  greeting: Localized;
  choices: VoiceChoice[];
  notUnderstood: Localized;
  handoff: Localized;
};

export type Customer = {
  id: string;
  name: string;
  city: string;
  iban: string;
  balanceEur: number;
};

export type TurnSource = "script" | "speech" | "quick_reply";

export type Turn =
  | { id: string; at: number; speaker: "mee"; text: string; source: "script" }
  | { id: string; at: number; speaker: "customer"; text: string; source: "speech" | "quick_reply"; matched: string | null };

export type CallPhase = "with_mee" | "with_agent" | "ended";

export type Call = {
  id: string;
  situationId: string;
  lang: Lang;
  phase: CallPhase;
  startedAt: number;
  handedOffAt?: number;
  handoffReason?: HandoffReason;
  endedAt?: number;
  misses: number;
  turns: Turn[];
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

export type MeeState = {
  customer: Customer;
  signals: Signal[];
  situations: Situation[];
  prefs: Prefs;
  marketingMutedUntil: number;
  call: Call | null;
  timeline: TimelineEntry[];
};

export type SignalInput = { [T in SignalType]: { type: T; payload: SignalPayload[T] } }[SignalType];

export type MeeCommand =
  | { kind: "signal"; signal: SignalInput }
  | { kind: "cta"; situationId: string; action: CtaAction; lang: Lang }
  | { kind: "customer_said"; callId: string; text: string; source: "speech" | "quick_reply" }
  | { kind: "end_call"; callId: string }
  | { kind: "voice_played"; situationId: string; channel: Channel }
  | { kind: "why_opened"; situationId: string }
  | { kind: "pause_mee"; paused: boolean }
  | { kind: "pause_type"; situationType: SituationType; paused: boolean }
  | { kind: "tick" }
  | { kind: "reset" };
