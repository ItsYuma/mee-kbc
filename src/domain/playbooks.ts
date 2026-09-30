import type { Channel, PlaybookAction, SituationType } from "./types";

export const PLAYBOOKS: Record<SituationType, Record<Channel, PlaybookAction>> = {
  checkout_stuck: {
    app: {
      situationType: "checkout_stuck",
      channel: "app",
      urgency: "time_critical",
      version: "PB-PAY-01 v3 · approved 2026-09-12",
      title: { en: "Payment didn't go through", nl: "Betaling lukte niet" },
      scriptText: {
        en: "Your card is fine, you just hit the contactless limit, so pay with Payconiq and you're through in one tap.",
        nl: "Je kaart is in orde, je hebt gewoon je contactloze limiet bereikt, dus betaal met Payconiq en je bent in één tik klaar.",
      },
      ctaLabel: { en: "Pay with Payconiq", nl: "Betaal met Payconiq" },
      ctaAction: "pay_with_payconiq",
      secondary: [{ ctaLabel: { en: "Call support", nl: "Bel support" }, ctaAction: "call_support" }],
    },
    agent: {
      situationType: "checkout_stuck",
      channel: "agent",
      urgency: "time_critical",
      version: "PB-PAY-01 v3 · approved 2026-09-12",
      title: { en: "Checkout stuck", nl: "Betaling vast" },
      scriptText: {
        en: "Two Bancontact declines on the contactless limit and the card is not blocked, so confirm Payconiq worked or suggest paying with PIN, and don't ask for card details.",
        nl: "Twee Bancontact-weigeringen op de contactloze limiet en de kaart is niet geblokkeerd, dus bevestig dat Payconiq lukte of stel betalen met pincode voor, en vraag geen kaartgegevens.",
      },
      ctaLabel: { en: "Mark as fixed", nl: "Markeer als opgelost" },
      ctaAction: "agent_resolve",
    },
  },
  cash_stress: {
    app: {
      situationType: "cash_stress",
      channel: "app",
      urgency: "soft",
      version: "PB-BUF-02 v2 · approved 2026-09-03",
      title: { en: "A little room until next week", nl: "Wat ademruimte tot volgende week" },
      scriptText: {
        en: "Rent is paid and your balance is low, so if you want, we can put a free 48-hour buffer of €200 on your account.",
        nl: "Je huur is betaald en je saldo is laag, dus als je wil zetten we een gratis buffer van €200 voor 48 uur op je rekening.",
      },
      ctaLabel: { en: "Turn on 48h buffer", nl: "Zet 48u-buffer aan" },
      ctaAction: "enable_buffer",
      secondary: [
        { ctaLabel: { en: "Not now", nl: "Nu niet" }, ctaAction: "not_now" },
        { ctaLabel: { en: "Don't show this again", nl: "Toon dit niet meer" }, ctaAction: "dismiss_forever" },
      ],
    },
    agent: {
      situationType: "cash_stress",
      channel: "agent",
      urgency: "soft",
      version: "PB-BUF-02 v2 · approved 2026-09-03",
      title: { en: "Tight week after rent", nl: "Krappe week na huur" },
      scriptText: {
        en: "The customer is in a tight week after rent and a free 48-hour buffer of €200 is ready, so don't pitch products, marketing is muted.",
        nl: "De klant zit in een krappe week na de huur en een gratis buffer van €200 voor 48 uur staat klaar, dus stel geen producten voor, marketing staat stil.",
      },
      ctaLabel: { en: "Mark as handled", nl: "Markeer als afgehandeld" },
      ctaAction: "agent_resolve",
    },
  },
};

export const SITUATION_LABEL: Record<SituationType, { en: string; nl: string }> = {
  checkout_stuck: { en: "Checkout stuck", nl: "Betaling vast" },
  cash_stress: { en: "Cash stress", nl: "Krappe maand" },
};
