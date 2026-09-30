import type { Lang, VoiceChoice } from "./types";

const NEGATIONS: Record<Lang, string[]> = {
  en: ["not", "no", "never", "dont", "don", "t"],
  nl: ["niet", "geen", "nooit"],
  fr: ["pas", "ne", "n", "jamais", "non"],
};

const NEGATION_WINDOW = 3;

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchChoice(text: string, lang: Lang, choices: VoiceChoice[]): VoiceChoice | null {
  const tokens = normalize(text).split(" ").filter(Boolean);
  const negations = NEGATIONS[lang];

  for (const choice of choices) {
    for (const raw of choice.keywords[lang]) {
      const kw = normalize(raw).split(" ");
      const kwIsNegative = kw.some((t) => negations.includes(t));
      for (let i = 0; i + kw.length <= tokens.length; i++) {
        if (!kw.every((t, j) => tokens[i + j] === t)) continue;
        const before = tokens.slice(Math.max(0, i - NEGATION_WINDOW), i);
        if (!kwIsNegative && before.some((t) => negations.includes(t))) continue;
        return choice;
      }
    }
  }
  return null;
}
