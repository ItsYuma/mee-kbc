import type { Lang, Localized, Signal, SignalType, SituationType } from "./types";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const BUFFER_THRESHOLD_EUR = 150;
export const HOME_COUNTRY = "BE";

export type FactIcon = "merchant" | "amount" | "code" | "card" | "place" | "salary" | "balance" | "muted" | "clean";
export type Fact = { icon: FactIcon; text: string };
export type Slots = Record<string, string>;

export type Rule = {
  situationType: SituationType;
  name: string;
  windowMs: number;
  ttlMs: number;
  dismissCooldownMs: number;
  resolvesOn: SignalType[];
  match: (recent: Signal[]) => Signal[] | null;
  slots: (matched: Signal[], lang: Lang) => Slots;
  explain: Localized;
  facts: Record<Lang, (s: Slots) => Fact[]>;
};

const LOCALE: Record<Lang, string> = { nl: "nl-BE", fr: "fr-BE", en: "en-BE" };

export const eur = (n: number, lang: Lang) => new Intl.NumberFormat(LOCALE[lang], { style: "currency", currency: "EUR" }).format(n);

export const countryName = (code: string, lang: Lang) => new Intl.DisplayNames([LOCALE[lang]], { type: "region" }).of(code) ?? code;

export function fill(template: string, slots: Slots): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => slots[k] ?? `{${k}}`);
}

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
    slots: (matched, lang) => {
      const [first, last] = ofType(matched, "payment_declined");
      return {
        merchant: last.payload.merchant,
        city: last.payload.city,
        amount: eur(last.payload.amountEur, lang),
        count: String(matched.length),
        minutes: String(minutesBetween(first, last)),
        code: last.payload.code,
      };
    },
    explain: {
      en: "Your Bancontact payment at {merchant} was declined {count} times within {minutes} min. So we're showing one quick fix.",
      nl: "Je Bancontact-betaling bij {merchant} werd {count} keer geweigerd binnen {minutes} min. Daarom tonen we één snelle oplossing.",
      fr: "Votre paiement Bancontact chez {merchant} a été refusé {count} fois en {minutes} min. Nous vous proposons donc une solution rapide.",
    },
    facts: {
      en: (s) => [
        { icon: "merchant", text: `${s.merchant}, ${s.city}` },
        { icon: "amount", text: s.amount },
        { icon: "code", text: `Code ${s.code} · contactless limit reached` },
        { icon: "card", text: "Bancontact •• 4821 · not blocked" },
      ],
      nl: (s) => [
        { icon: "merchant", text: `${s.merchant}, ${s.city}` },
        { icon: "amount", text: s.amount },
        { icon: "code", text: `Code ${s.code} · contactloze limiet bereikt` },
        { icon: "card", text: "Bancontact •• 4821 · niet geblokkeerd" },
      ],
      fr: (s) => [
        { icon: "merchant", text: `${s.merchant}, ${s.city}` },
        { icon: "amount", text: s.amount },
        { icon: "code", text: `Code ${s.code} · plafond sans contact atteint` },
        { icon: "card", text: "Bancontact •• 4821 · non bloquée" },
      ],
    },
  },
  card_blocked_abroad: {
    situationType: "card_blocked_abroad",
    name: "R-CRD-03 · card blocked outside Belgium",
    windowMs: 2 * HOUR,
    ttlMs: 6 * HOUR,
    dismissCooldownMs: 1 * HOUR,
    resolvesOn: ["card_unblocked"],
    match: (recent) => {
      const block = latest(ofType(recent, "card_blocked"));
      return block && block.payload.countryCode !== HOME_COUNTRY ? [block] : null;
    },
    slots: (matched, lang) => {
      const block = latest(ofType(matched, "card_blocked"))!;
      return {
        card: block.payload.card,
        merchant: block.payload.merchant,
        amount: eur(block.payload.amountEur, lang),
        city: block.payload.city,
        country: countryName(block.payload.countryCode, lang),
      };
    },
    explain: {
      en: "Your card {card} was paused after a payment of {amount} at {merchant} in {city}, {country}, far from where you usually pay.",
      nl: "Je kaart {card} werd gepauzeerd na een betaling van {amount} bij {merchant} in {city}, {country}, ver van waar je normaal betaalt.",
      fr: "Votre carte {card} a été suspendue après un paiement de {amount} chez {merchant} à {city}, {country}, loin de vos habitudes.",
    },
    facts: {
      en: (s) => [
        { icon: "place", text: `${s.city}, ${s.country}` },
        { icon: "card", text: `Debit card ${s.card} · blocked by safety rule` },
        { icon: "merchant", text: `${s.merchant} · ${s.amount}` },
        { icon: "clean", text: "No fraud reported before the block" },
      ],
      nl: (s) => [
        { icon: "place", text: `${s.city}, ${s.country}` },
        { icon: "card", text: `Debetkaart ${s.card} · geblokkeerd door veiligheidsregel` },
        { icon: "merchant", text: `${s.merchant} · ${s.amount}` },
        { icon: "clean", text: "Geen fraude gemeld vóór de blokkering" },
      ],
      fr: (s) => [
        { icon: "place", text: `${s.city}, ${s.country}` },
        { icon: "card", text: `Carte de débit ${s.card} · bloquée par règle de sécurité` },
        { icon: "merchant", text: `${s.merchant} · ${s.amount}` },
        { icon: "clean", text: "Aucune fraude signalée avant le blocage" },
      ],
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
    slots: (matched, lang) => {
      const salary = latest(ofType(matched, "salary_received"))!;
      const rent = latest(ofType(matched, "rent_paid"))!;
      const low = latest(ofType(matched, "balance_low"))!;
      return {
        employer: salary.payload.employer,
        salary: eur(salary.payload.amountEur, lang),
        rent: eur(rent.payload.amountEur, lang),
        balance: eur(low.payload.balanceEur, lang),
        threshold: eur(BUFFER_THRESHOLD_EUR, lang),
      };
    },
    explain: {
      en: "Your salary ({salary}) came in, your rent ({rent}) went out, and your balance is now {balance}, below {threshold}.",
      nl: "Je loon ({salary}) kwam binnen, je huur ({rent}) ging eraf, en je saldo staat nu op {balance}, onder de {threshold}.",
      fr: "Votre salaire ({salary}) est arrivé, votre loyer ({rent}) est parti, et votre solde est maintenant de {balance}, sous les {threshold}.",
    },
    facts: {
      en: (s) => [
        { icon: "salary", text: `Salary from ${s.employer}: ${s.salary}` },
        { icon: "balance", text: `Balance now: ${s.balance}` },
        { icon: "muted", text: "Marketing muted for 72h" },
        { icon: "clean", text: "No open complaints or claims" },
      ],
      nl: (s) => [
        { icon: "salary", text: `Loon van ${s.employer}: ${s.salary}` },
        { icon: "balance", text: `Saldo nu: ${s.balance}` },
        { icon: "muted", text: "Marketing gedempt voor 72 u" },
        { icon: "clean", text: "Geen lopende klachten of claims" },
      ],
      fr: (s) => [
        { icon: "salary", text: `Salaire de ${s.employer} : ${s.salary}` },
        { icon: "balance", text: `Solde actuel : ${s.balance}` },
        { icon: "muted", text: "Marketing coupé pendant 72 h" },
        { icon: "clean", text: "Aucune plainte ni sinistre en cours" },
      ],
    },
  },
};

export const explainSituation = (type: SituationType, matched: Signal[], lang: Lang) => fill(RULES[type].explain[lang], RULES[type].slots(matched, lang));
export const situationFacts = (type: SituationType, matched: Signal[], lang: Lang) => RULES[type].facts[lang](RULES[type].slots(matched, lang));

export const NOT_USED: Record<Lang, string[]> = {
  en: ["Social media or contacts", "How you type or swipe", "Who you send money to privately", "Location outside a card payment"],
  nl: ["Sociale media of contacten", "Hoe je typt of swipet", "Aan wie je privé geld stuurt", "Locatie buiten een kaartbetaling"],
  fr: ["Réseaux sociaux ou contacts", "Votre façon de taper ou de glisser", "À qui vous envoyez de l'argent en privé", "Votre position en dehors d'un paiement par carte"],
};
