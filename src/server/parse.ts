import { z } from "zod";
import { LANGS } from "@/domain/types";

const eur = z.number().finite();
const lang = z.enum(LANGS);
const situationType = z.enum(["checkout_stuck", "card_blocked_abroad", "cash_stress"]);
const text = z.string().trim().min(1).max(500);

export const signalInput = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("payment_declined"),
    payload: z.object({ merchant: z.string(), amountEur: eur, scheme: z.literal("Bancontact"), code: z.string(), city: z.string() }),
  }),
  z.object({ type: z.literal("payment_succeeded"), payload: z.object({ merchant: z.string(), amountEur: eur, method: z.string() }) }),
  z.object({
    type: z.literal("card_blocked"),
    payload: z.object({
      card: z.string(),
      merchant: z.string(),
      amountEur: eur,
      city: z.string(),
      countryCode: z.string().regex(/^[A-Z]{2}$/),
      reason: z.string(),
    }),
  }),
  z.object({ type: z.literal("card_unblocked"), payload: z.object({ card: z.string() }) }),
  z.object({ type: z.literal("salary_received"), payload: z.object({ employer: z.string(), amountEur: eur }) }),
  z.object({ type: z.literal("rent_paid"), payload: z.object({ payee: z.string(), amountEur: eur }) }),
  z.object({ type: z.literal("balance_low"), payload: z.object({ balanceEur: eur }) }),
  z.object({ type: z.literal("balance_recovered"), payload: z.object({ balanceEur: eur }) }),
]);

export const actionInput = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("cta"),
    situationId: z.string(),
    action: z.enum(["pay_with_payconiq", "unblock_card", "enable_buffer", "talk_to_mee", "not_now", "dismiss_forever", "agent_resolve"]),
    lang,
  }),
  z.object({ kind: z.literal("customer_said"), callId: z.string(), text, source: z.enum(["speech", "quick_reply"]) }),
  z.object({ kind: z.literal("end_call"), callId: z.string() }),
  z.object({ kind: z.literal("voice_played"), situationId: z.string(), channel: z.enum(["app", "agent"]) }),
  z.object({ kind: z.literal("why_opened"), situationId: z.string() }),
  z.object({ kind: z.literal("pause_mee"), paused: z.boolean() }),
  z.object({ kind: z.literal("pause_type"), situationType, paused: z.boolean() }),
  z.object({ kind: z.literal("reset") }),
]);

export const ttsInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("situation"), situationId: z.string(), channel: z.enum(["app", "agent"]), lang }).strict(),
  z.object({ kind: z.literal("turn"), callId: z.string(), turnId: z.string() }).strict(),
  z.object({ kind: z.literal("classic_ivr"), lang }).strict(),
]);

export type TtsInput = z.infer<typeof ttsInput>;

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export const sttInput = z.object({
  audio: z.instanceof(Blob).refine((b) => b.size > 0 && b.size <= MAX_AUDIO_BYTES, "audio must be 1 byte to 10 MB"),
  callId: z.string(),
  lang,
});

export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; res: Response }> {
  const json = await req.json().catch(() => undefined);
  return validate(json, schema);
}

export async function parseForm<T>(req: Request, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; res: Response }> {
  const form = await req.formData().catch(() => undefined);
  return validate(form && Object.fromEntries(form), schema);
}

function validate<T>(input: unknown, schema: z.ZodType<T>): { ok: true; data: T } | { ok: false; res: Response } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, res: Response.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 }) };
}
