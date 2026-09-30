import { z } from "zod";

const eur = z.number().finite();
const situationType = z.enum(["checkout_stuck", "cash_stress"]);

export const signalInput = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("payment_declined"),
    payload: z.object({ merchant: z.string(), amountEur: eur, scheme: z.literal("Bancontact"), code: z.string(), city: z.string() }),
  }),
  z.object({ type: z.literal("payment_succeeded"), payload: z.object({ merchant: z.string(), amountEur: eur, method: z.string() }) }),
  z.object({ type: z.literal("salary_received"), payload: z.object({ employer: z.string(), amountEur: eur }) }),
  z.object({ type: z.literal("rent_paid"), payload: z.object({ payee: z.string(), amountEur: eur }) }),
  z.object({ type: z.literal("balance_low"), payload: z.object({ balanceEur: eur }) }),
  z.object({ type: z.literal("balance_recovered"), payload: z.object({ balanceEur: eur }) }),
]);

export const actionInput = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("cta"),
    situationId: z.string(),
    action: z.enum(["pay_with_payconiq", "call_support", "enable_buffer", "not_now", "dismiss_forever", "agent_resolve"]),
  }),
  z.object({ kind: z.literal("voice_played"), situationId: z.string(), channel: z.enum(["app", "agent"]) }),
  z.object({ kind: z.literal("why_opened"), situationId: z.string() }),
  z.object({ kind: z.literal("pause_mee"), paused: z.boolean() }),
  z.object({ kind: z.literal("pause_type"), situationType, paused: z.boolean() }),
  z.object({ kind: z.literal("reset") }),
]);

export const ttsInput = z.object({
  situationId: z.string(),
  channel: z.enum(["app", "agent"]),
  lang: z.enum(["nl", "en"]),
});

export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; res: Response }> {
  const json = await req.json().catch(() => undefined);
  const parsed = schema.safeParse(json);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, res: Response.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 }) };
}
