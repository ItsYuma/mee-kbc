import type { AgentPlaybook, Localized, PlaybookAction, SituationType, VoiceChoice, VoiceFlow } from "./types";

export const SITUATION_LABEL: Record<SituationType, Localized> = {
  checkout_stuck: { en: "Checkout stuck", nl: "Betaling vast", fr: "Paiement bloqué" },
  card_blocked_abroad: { en: "Card blocked abroad", nl: "Kaart geblokkeerd in het buitenland", fr: "Carte bloquée à l'étranger" },
  cash_stress: { en: "Cash stress", nl: "Krappe maand", fr: "Fin de mois serrée" },
};

const TALK_TO_MEE = { ctaLabel: { en: "Talk to Mee", nl: "Praat met Mee", fr: "Parler à Mee" }, ctaAction: "talk_to_mee" } as const;

export const APP_PLAYBOOKS: Record<SituationType, PlaybookAction> = {
  checkout_stuck: {
    situationType: "checkout_stuck",
    channel: "app",
    urgency: "time_critical",
    version: "PB-PAY-01 v4 · approved 2026-09-30",
    title: { en: "Payment didn't go through", nl: "Betaling lukte niet", fr: "Le paiement n'est pas passé" },
    scriptText: {
      en: "Your card is fine, you just hit the contactless limit, so pay with Payconiq and you're through in one tap.",
      nl: "Je kaart is in orde, je hebt gewoon je contactloze limiet bereikt, dus betaal met Payconiq en je bent in één tik klaar.",
      fr: "Votre carte fonctionne, vous avez juste atteint le plafond sans contact, alors payez avec Payconiq et c'est réglé en un geste.",
    },
    ctaLabel: { en: "Pay with Payconiq", nl: "Betaal met Payconiq", fr: "Payer avec Payconiq" },
    ctaAction: "pay_with_payconiq",
    secondary: [TALK_TO_MEE],
  },
  card_blocked_abroad: {
    situationType: "card_blocked_abroad",
    channel: "app",
    urgency: "time_critical",
    version: "PB-CRD-03 v1 · approved 2026-09-30",
    title: { en: "We paused your card for safety", nl: "We pauzeerden je kaart voor je veiligheid", fr: "Nous avons suspendu votre carte par sécurité" },
    scriptText: {
      en: "A payment abroad didn't look like you, so we paused your card, and if it was you, unblock it now in one tap.",
      nl: "Een betaling in het buitenland leek niet op jou, dus pauzeerden we je kaart, en als jij het was, deblokkeer je ze nu in één tik.",
      fr: "Un paiement à l'étranger ne vous ressemblait pas, nous avons donc suspendu votre carte, et si c'était vous, débloquez-la maintenant en un geste.",
    },
    ctaLabel: { en: "It was me, unblock", nl: "Ik was het, deblokkeer", fr: "C'était moi, débloquer" },
    ctaAction: "unblock_card",
    secondary: [TALK_TO_MEE],
  },
  cash_stress: {
    situationType: "cash_stress",
    channel: "app",
    urgency: "soft",
    version: "PB-BUF-02 v3 · approved 2026-09-30",
    title: { en: "A little room until next week", nl: "Wat ademruimte tot volgende week", fr: "Un peu d'air jusqu'à la semaine prochaine" },
    scriptText: {
      en: "Rent is paid and your balance is low, so if you want, we can put a free 48-hour buffer of €200 on your account.",
      nl: "Je huur is betaald en je saldo is laag, dus als je wil zetten we een gratis buffer van €200 voor 48 uur op je rekening.",
      fr: "Votre loyer est payé et votre solde est bas, alors si vous le souhaitez, nous pouvons ajouter une réserve gratuite de 200 € pendant 48 heures.",
    },
    ctaLabel: { en: "Turn on 48h buffer", nl: "Zet 48u-buffer aan", fr: "Activer la réserve 48 h" },
    ctaAction: "enable_buffer",
    secondary: [
      { ctaLabel: { en: "Not now", nl: "Nu niet", fr: "Pas maintenant" }, ctaAction: "not_now" },
      { ctaLabel: { en: "Don't show this again", nl: "Toon dit niet meer", fr: "Ne plus afficher" }, ctaAction: "dismiss_forever" },
    ],
  },
};

export const AGENT_PLAYBOOKS: Record<SituationType, AgentPlaybook> = {
  checkout_stuck: {
    version: "PB-PAY-01 v4 · approved 2026-09-30",
    whisper: {
      en: "{name} had two Bancontact declines at {merchant} on the contactless limit, the card is fine, so don't ask for card details.",
      nl: "{name} had twee Bancontact-weigeringen bij {merchant} op de contactloze limiet, de kaart is in orde, dus vraag geen kaartgegevens.",
      fr: "{name} a eu deux refus Bancontact chez {merchant} à cause du plafond sans contact, la carte fonctionne, ne demandez pas les données de la carte.",
    },
    recommended: {
      en: "Confirm Payconiq worked, or suggest paying with PIN.",
      nl: "Bevestig dat Payconiq lukte, of stel betalen met pincode voor.",
      fr: "Confirmez que Payconiq a fonctionné, ou proposez de payer avec le code PIN.",
    },
    ctaLabel: { en: "Mark as fixed", nl: "Markeer als opgelost", fr: "Marquer comme résolu" },
  },
  card_blocked_abroad: {
    version: "PB-CRD-03 v1 · approved 2026-09-30",
    whisper: {
      en: "{name} is in {city} and her card {card} was paused by the travel safety rule, so verify her with itsme, then unblock, and don't ask where she is.",
      nl: "{name} is in {city} en haar kaart {card} werd gepauzeerd door de reisveiligheidsregel, dus verifieer met itsme, deblokkeer, en vraag niet waar ze is.",
      fr: "{name} est à {city} et sa carte {card} a été suspendue par la règle de sécurité voyage, vérifiez-la avec itsme, débloquez, et ne demandez pas où elle est.",
    },
    recommended: {
      en: "Verify with itsme, then unblock the card.",
      nl: "Verifieer met itsme en deblokkeer dan de kaart.",
      fr: "Vérifiez avec itsme, puis débloquez la carte.",
    },
    ctaLabel: { en: "Unblock and close", nl: "Deblokkeer en sluit af", fr: "Débloquer et clôturer" },
    byHandoff: {
      not_me: {
        whisper: {
          en: "{name} says the payment of {amount} at {merchant} in {city} was not hers, so keep card {card} blocked, open a fraud case and order a new card, and don't ask her to repeat what happened.",
          nl: "{name} zegt dat de betaling van {amount} bij {merchant} in {city} niet van haar was, dus laat kaart {card} geblokkeerd, open een fraudedossier en bestel een nieuwe kaart, en laat haar niets herhalen.",
          fr: "{name} dit que le paiement de {amount} chez {merchant} à {city} n'était pas d'elle, gardez la carte {card} bloquée, ouvrez un dossier fraude et commandez une nouvelle carte, sans lui faire répéter ce qui s'est passé.",
        },
        recommended: {
          en: "Keep the card blocked, open a fraud case, order a new card.",
          nl: "Laat de kaart geblokkeerd, open een fraudedossier, bestel een nieuwe kaart.",
          fr: "Gardez la carte bloquée, ouvrez un dossier fraude, commandez une nouvelle carte.",
        },
        ctaLabel: { en: "Open fraud case and close", nl: "Open fraudedossier en sluit af", fr: "Ouvrir le dossier fraude et clôturer" },
      },
    },
  },
  cash_stress: {
    version: "PB-BUF-02 v3 · approved 2026-09-30",
    whisper: {
      en: "{name} is in a tight week after rent with {balance} left, so don't pitch any product, marketing is muted.",
      nl: "{name} zit in een krappe week na de huur met nog {balance}, dus stel geen enkel product voor, marketing staat stil.",
      fr: "{name} traverse une semaine serrée après le loyer avec {balance} restants, ne proposez aucun produit, le marketing est coupé.",
    },
    recommended: {
      en: "Offer the free 48-hour buffer of €200.",
      nl: "Bied de gratis buffer van €200 voor 48 uur aan.",
      fr: "Proposez la réserve gratuite de 200 € pendant 48 heures.",
    },
    ctaLabel: { en: "Mark as handled", nl: "Markeer als afgehandeld", fr: "Marquer comme traité" },
  },
};

const HUMAN: VoiceChoice = {
  id: "human",
  keywords: {
    en: ["someone", "somebody", "person", "human", "agent", "advisor", "adviser", "talk to", "speak to"],
    nl: ["iemand", "persoon", "mens", "medewerker", "adviseur", "spreken", "doorverbinden"],
    fr: ["quelqu'un", "quelqu un", "personne", "humain", "conseiller", "conseillere", "parler a"],
  },
  quickReply: { en: "I'd rather talk to someone.", nl: "Ik spreek liever iemand.", fr: "Je préfère parler à quelqu'un." },
  reply: {
    en: "Of course, I'm putting you through now.",
    nl: "Natuurlijk, ik verbind je nu door.",
    fr: "Bien sûr, je vous passe quelqu'un.",
  },
  effect: { kind: "handoff" },
};

const HANDOFF: Localized = {
  en: "Anouk is picking up. She already knows what happened, so you won't have to explain anything again.",
  nl: "Anouk neemt op. Ze weet al wat er gebeurde, dus je hoeft niets opnieuw uit te leggen.",
  fr: "Anouk prend l'appel. Elle sait déjà ce qui s'est passé, vous n'aurez rien à réexpliquer.",
};

export const VOICE_FLOWS: Record<SituationType, VoiceFlow> = {
  checkout_stuck: {
    version: "VF-PAY-01 v1 · approved 2026-09-30",
    greeting: {
      en: "Hi {name}, it's Mee. Your payment of {amount} at {merchant} was declined twice, but your card isn't blocked, you just hit the contactless limit. Shall I send you a Payconiq link, or would you rather talk to someone?",
      nl: "Hoi {name}, met Mee. Je betaling van {amount} bij {merchant} werd twee keer geweigerd, maar je kaart is niet geblokkeerd, je zit gewoon aan je contactloze limiet. Zal ik je een Payconiq-link sturen, of spreek je liever iemand?",
      fr: "Bonjour {name}, c'est Mee. Votre paiement de {amount} chez {merchant} a été refusé deux fois, mais votre carte n'est pas bloquée, vous avez juste atteint le plafond sans contact. Je vous envoie un lien Payconiq, ou vous préférez parler à quelqu'un ?",
    },
    choices: [
      HUMAN,
      {
        id: "payconiq",
        keywords: {
          en: ["payconiq", "pay coniq", "payconic", "pay connect", "link", "qr", "yes", "yeah", "sure", "ok", "okay", "please"],
          nl: ["payconiq", "link", "qr", "ja", "graag", "oke", "ok", "doe maar", "stuur"],
          fr: ["payconiq", "lien", "qr", "oui", "ouais", "d'accord", "ok", "volontiers", "envoie", "envoyez"],
        },
        quickReply: { en: "Yes, send me the Payconiq link.", nl: "Ja, stuur me de Payconiq-link.", fr: "Oui, envoyez-moi le lien Payconiq." },
        reply: {
          en: "Done. The Payconiq link is on your screen, scan it at the till and you're through.",
          nl: "Klaar. De Payconiq-link staat op je scherm, scan hem aan de kassa en je bent klaar.",
          fr: "C'est fait. Le lien Payconiq est sur votre écran, scannez-le à la caisse et c'est réglé.",
        },
        effect: { kind: "cta", action: "pay_with_payconiq" },
      },
    ],
    notUnderstood: {
      en: "Sorry, I didn't catch that. You can say Payconiq, or ask for a person.",
      nl: "Sorry, dat verstond ik niet. Zeg Payconiq, of vraag naar een persoon.",
      fr: "Pardon, je n'ai pas compris. Dites Payconiq, ou demandez à parler à quelqu'un.",
    },
    handoff: HANDOFF,
  },
  card_blocked_abroad: {
    version: "VF-CRD-03 v1 · approved 2026-09-30",
    greeting: {
      en: "Hi {name}, it's Mee. I see your card {card} was paused after a payment of {amount} at {merchant} in {city}. If that was you, I can unblock it right now. Was it you?",
      nl: "Hoi {name}, met Mee. Ik zie dat je kaart {card} gepauzeerd werd na een betaling van {amount} bij {merchant} in {city}. Als jij dat was, deblokkeer ik ze meteen. Was jij het?",
      fr: "Bonjour {name}, c'est Mee. Je vois que votre carte {card} a été suspendue après un paiement de {amount} chez {merchant} à {city}. Si c'était vous, je peux la débloquer tout de suite. C'était bien vous ?",
    },
    choices: [
      HUMAN,
      {
        id: "not_me",
        keywords: {
          en: ["not me", "wasn't me", "was not me", "no", "fraud", "stolen", "didn't"],
          nl: ["niet ik", "was ik niet", "nee", "fraude", "gestolen"],
          fr: ["pas moi", "non", "fraude", "vole", "vol"],
        },
        quickReply: { en: "No, that wasn't me.", nl: "Nee, dat was ik niet.", fr: "Non, ce n'était pas moi." },
        reply: {
          en: "Okay, your card stays blocked and your money is safe. I'm putting you through to a fraud specialist.",
          nl: "Oké, je kaart blijft geblokkeerd en je geld is veilig. Ik verbind je door met een fraudespecialist.",
          fr: "D'accord, votre carte reste bloquée et votre argent est en sécurité. Je vous passe un spécialiste fraude.",
        },
        effect: { kind: "handoff" },
      },
      {
        id: "unblock",
        keywords: {
          en: ["it was me", "that was me", "was me", "me", "yes", "yeah", "unblock", "correct", "sure"],
          nl: ["ik was het", "dat was ik", "was ik", "ja", "deblokkeer", "klopt"],
          fr: ["c'etait moi", "c etait moi", "c'est moi", "moi", "oui", "debloque", "debloquer", "exact"],
        },
        quickReply: { en: "Yes, that was me.", nl: "Ja, dat was ik.", fr: "Oui, c'était moi." },
        reply: {
          en: "Thanks. Your card is unblocked, try the payment again and it will go through.",
          nl: "Bedankt. Je kaart is gedeblokkeerd, probeer de betaling opnieuw en ze gaat erdoor.",
          fr: "Merci. Votre carte est débloquée, réessayez le paiement, il passera.",
        },
        effect: { kind: "cta", action: "unblock_card" },
      },
    ],
    notUnderstood: {
      en: "Sorry, I didn't catch that. Was the payment in {city} you, yes or no?",
      nl: "Sorry, dat verstond ik niet. Was de betaling in {city} van jou, ja of nee?",
      fr: "Pardon, je n'ai pas compris. Le paiement à {city}, c'était vous, oui ou non ?",
    },
    handoff: HANDOFF,
  },
  cash_stress: {
    version: "VF-BUF-02 v1 · approved 2026-09-30",
    greeting: {
      en: "Hi {name}, it's Mee. Rent is paid and your balance is {balance}. I can put a free 48-hour buffer of 200 euros on your account. Shall I turn it on?",
      nl: "Hoi {name}, met Mee. Je huur is betaald en je saldo staat op {balance}. Ik kan een gratis buffer van 200 euro voor 48 uur op je rekening zetten. Zal ik die aanzetten?",
      fr: "Bonjour {name}, c'est Mee. Votre loyer est payé et votre solde est de {balance}. Je peux ajouter une réserve gratuite de 200 euros pendant 48 heures. Je l'active ?",
    },
    choices: [
      HUMAN,
      {
        id: "not_now",
        keywords: {
          en: ["not now", "no", "later", "no thanks"],
          nl: ["nu niet", "nee", "later", "liever niet"],
          fr: ["pas maintenant", "non", "plus tard", "non merci"],
        },
        quickReply: { en: "Not now, thanks.", nl: "Nu niet, bedankt.", fr: "Pas maintenant, merci." },
        reply: {
          en: "No problem, I won't bring it up again this week.",
          nl: "Geen probleem, ik begin er deze week niet meer over.",
          fr: "Pas de souci, je n'en reparlerai pas cette semaine.",
        },
        effect: { kind: "cta", action: "not_now" },
      },
      {
        id: "enable",
        keywords: {
          en: ["yes", "yeah", "turn it on", "please", "ok", "okay", "sure"],
          nl: ["ja", "zet aan", "graag", "ok", "oke", "doe maar"],
          fr: ["oui", "active", "activez", "volontiers", "ok", "d'accord"],
        },
        quickReply: { en: "Yes, turn it on.", nl: "Ja, zet hem aan.", fr: "Oui, activez-la." },
        reply: {
          en: "Done. The 200 euro buffer is on for 48 hours, and nothing else changes.",
          nl: "Klaar. De buffer van 200 euro staat 48 uur aan, en verder verandert er niets.",
          fr: "C'est fait. La réserve de 200 euros est active pendant 48 heures, rien d'autre ne change.",
        },
        effect: { kind: "cta", action: "enable_buffer" },
      },
    ],
    notUnderstood: {
      en: "Sorry, I didn't catch that. Shall I turn on the buffer, yes or no?",
      nl: "Sorry, dat verstond ik niet. Zal ik de buffer aanzetten, ja of nee?",
      fr: "Pardon, je n'ai pas compris. J'active la réserve, oui ou non ?",
    },
    handoff: HANDOFF,
  },
};

export const CLASSIC_IVR: Localized = {
  en: "Welcome to the bank. For cards, press 1. For loans, press 2. For insurance, press 3. For anything else, please stay on the line. All our advisors are currently busy. Your estimated waiting time is 14 minutes.",
  nl: "Welkom bij de bank. Voor kaarten, druk 1. Voor leningen, druk 2. Voor verzekeringen, druk 3. Voor al het andere, blijf aan de lijn. Al onze adviseurs zijn momenteel in gesprek. Je geschatte wachttijd is 14 minuten.",
  fr: "Bienvenue à la banque. Pour les cartes, tapez 1. Pour les crédits, tapez 2. Pour les assurances, tapez 3. Pour toute autre question, restez en ligne. Tous nos conseillers sont occupés. Votre temps d'attente estimé est de 14 minutes.",
};
