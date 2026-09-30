import type { Lang, Signal, SignalType, SituationType } from "./types";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const BUFFER_THRESHOLD_EUR = 150;

export type Rule = {
  situationType: SituationType;
  name: string;
  windowMs: number;
  ttlMs: number;
  dismissCooldownMs: number;
  resolvesOn: SignalType[];
  match: (recent: Signal[]) => Signal[] | null;
  explain: (matched: Signal[], lang: Lang) => string;
  knownFacts: (matched: Signal[], lang: Lang) => string[];
};

const eur = (n: number, lang: Lang) =>
  new Intl.NumberFormat(lang === "nl" ? "nl-BE" : "en-BE", { style: "currency", currency: "EUR" }).format(n);

const ofType = <T extends SignalType>(signals: Signal[], type: T) =>
  signals.filter((s): s is Extract<Signal, { type: T }> => s.type === type);

const latest = <T extends Signal>(signals: T[]): T | undefined => signals.at(-1);

const minutesBetween = (a: Signal, b: Signal) => Math.max(1, Math.round(Math.abs(b.timestamp - a.timestamp) / MIN));

export const RULES: Record<SituationType, Rule> = {
  checkout_stuck: {
    situationType: "checkout_stuck",
    name: "R-PAY-01 · 2× Bancontact decline within 10 min",
    windowMs: 10 * MIN,
    ttlMs: 30 * MIN,
    dismissCooldownMs: 2 * HOUR,
    resolvesOn: ["payment_succeeded"],
    match: (recent) => {
      const declines = ofType(recent, "payment_declined");
      return declines.length >= 2 ? declines.slice(-2) : null;
    },
    explain: (matched, lang) => {
      const [first, last] = ofType(matched, "payment_declined");
      const mins = minutesBetween(first, last);
      return lang === "nl"
        ? `Je Bancontact-betaling bij ${last.payload.merchant} werd ${matched.length} keer geweigerd binnen ${mins} min. Daarom tonen we één snelle oplossing.`
        : `Your Bancontact payment at ${last.payload.merchant} was declined ${matched.length} times within ${mins} min. So we're showing one quick fix.`;
    },
    knownFacts: (matched, lang) => {
      const last = latest(ofType(matched, "payment_declined"))!;
      return lang === "nl"
        ? [
            `Handelaar: ${last.payload.merchant}, ${last.payload.city}`,
            `Bedrag: ${eur(last.payload.amountEur, lang)}`,
            `Weigeringscode: ${last.payload.code} (contactloze limiet bereikt)`,
            `Kaart: Bancontact •• 4821, niet geblokkeerd`,
          ]
        : [
            `Merchant: ${last.payload.merchant}, ${last.payload.city}`,
            `Amount: ${eur(last.payload.amountEur, lang)}`,
            `Decline code: ${last.payload.code} (contactless limit reached)`,
            `Card: Bancontact •• 4821, not blocked`,
          ];
    },
  },
  cash_stress: {
    situationType: "cash_stress",
    name: "R-BUF-02 · salary + rent + balance under €150 within 7 days",
    windowMs: 7 * DAY,
    ttlMs: 5 * DAY,
    dismissCooldownMs: 30 * DAY,
    resolvesOn: ["balance_recovered"],
    match: (recent) => {
      const salary = latest(ofType(recent, "salary_received"));
      const rent = latest(ofType(recent, "rent_paid"));
      const low = latest(ofType(recent, "balance_low"));
      if (!salary || !rent || !low) return null;
      if (low.payload.balanceEur >= BUFFER_THRESHOLD_EUR) return null;
      if (!(salary.timestamp <= rent.timestamp && rent.timestamp <= low.timestamp)) return null;
      return [salary, rent, low];
    },
    explain: (matched, lang) => {
      const salary = latest(ofType(matched, "salary_received"))!;
      const rent = latest(ofType(matched, "rent_paid"))!;
      const low = latest(ofType(matched, "balance_low"))!;
      return lang === "nl"
        ? `Je loon (${eur(salary.payload.amountEur, lang)}) kwam binnen, je huur (${eur(rent.payload.amountEur, lang)}) ging eraf, en je saldo staat nu op ${eur(low.payload.balanceEur, lang)}, onder de ${eur(BUFFER_THRESHOLD_EUR, lang)}.`
        : `Your salary (${eur(salary.payload.amountEur, lang)}) came in, your rent (${eur(rent.payload.amountEur, lang)}) went out, and your balance is now ${eur(low.payload.balanceEur, lang)}, below ${eur(BUFFER_THRESHOLD_EUR, lang)}.`;
    },
    knownFacts: (matched, lang) => {
      const salary = latest(ofType(matched, "salary_received"))!;
      const low = latest(ofType(matched, "balance_low"))!;
      return lang === "nl"
        ? [
            `Loon van ${salary.payload.employer}: ${eur(salary.payload.amountEur, lang)}`,
            `Saldo nu: ${eur(low.payload.balanceEur, lang)}`,
            `Marketing gedempt voor 72 u`,
            `Geen lopende klachten of claims`,
          ]
        : [
            `Salary from ${salary.payload.employer}: ${eur(salary.payload.amountEur, lang)}`,
            `Balance now: ${eur(low.payload.balanceEur, lang)}`,
            `Marketing muted for 72h`,
            `No open complaints or claims`,
          ];
    },
  },
};

export const NOT_USED: Record<Lang, string[]> = {
  en: ["Social media or contacts", "How you type or swipe", "Who you send money to privately", "Location outside a card payment"],
  nl: ["Sociale media of contacten", "Hoe je typt of swipet", "Aan wie je privé geld stuurt", "Locatie buiten een kaartbetaling"],
};
