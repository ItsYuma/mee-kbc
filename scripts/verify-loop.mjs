import assert from "node:assert/strict";

const BASE = process.env.MEE_URL ?? "http://127.0.0.1:4317";

const post = async (path, body) => {
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, type: res.headers.get("content-type"), body: res.headers.get("content-type")?.includes("json") ? await res.json() : null };
};
const get = async () => (await fetch(BASE + "/api/situation")).json();
const active = (s, type) => s.situations.find((x) => x.status === "active" && x.type === type);

const DECLINE = { type: "payment_declined", payload: { merchant: "Delhaize Korenmarkt", amountEur: 42.6, scheme: "Bancontact", code: "65", city: "Gent" } };
const SALARY = { type: "salary_received", payload: { employer: "Studio Noord BV", amountEur: 2140 } };
const RENT = { type: "rent_paid", payload: { payee: "Immo Vandenbroucke", amountEur: 1150 } };
const LOW = { type: "balance_low", payload: { balanceEur: 84.3 } };

const checks = [];
const check = async (name, fn) => {
  await fn();
  checks.push(name);
  console.log(`ok  ${name}`);
};

await post("/api/actions", { kind: "reset" });

await check("one decline does not open a situation", async () => {
  const s = (await post("/api/events", DECLINE)).body;
  assert.equal(s.situations.length, 0);
});

let stuck;
await check("second decline opens checkout_stuck with both signals", async () => {
  const s = (await post("/api/events", DECLINE)).body;
  stuck = active(s, "checkout_stuck");
  assert.ok(stuck);
  assert.equal(stuck.signals.length, 2);
});

await check("a third decline does not open a second nudge", async () => {
  const s = (await post("/api/events", DECLINE)).body;
  assert.equal(s.situations.filter((x) => x.type === "checkout_stuck").length, 1);
});

await check("TTS speaks only the approved app script", async () => {
  const r = await post("/api/tts", { situationId: stuck.id, channel: "app", lang: "en", text: "Buy our premium card!" });
  assert.equal(r.status, 200);
  if (r.body) {
    assert.equal(r.body.mode, "mock");
    assert.equal(r.body.text, "Your card is fine, you just hit the contactless limit, so pay with Payconiq and you're through in one tap.");
  } else {
    assert.equal(r.type, "audio/mpeg");
  }
});

await check("TTS rejects unknown situations and bad bodies", async () => {
  assert.equal((await post("/api/tts", { situationId: "nope", channel: "app", lang: "en" })).status, 404);
  assert.equal((await post("/api/tts", { situationId: stuck.id, channel: "sms", lang: "en" })).status, 400);
});

await check("call support hands the same situation to the agent", async () => {
  const s = (await post("/api/actions", { kind: "cta", situationId: stuck.id, action: "call_support" })).body;
  assert.equal(s.supportCall.situationId, stuck.id);
});

await check("Payconiq CTA resolves via a payment_succeeded signal", async () => {
  const s = (await post("/api/actions", { kind: "cta", situationId: stuck.id, action: "pay_with_payconiq" })).body;
  assert.equal(s.situations.find((x) => x.id === stuck.id).status, "resolved");
  assert.equal(s.signals.at(-1).type, "payment_succeeded");
  assert.equal(s.signals.at(-1).payload.method, "Payconiq");
});

await check("old declines are consumed and do not re-fire after resolve", async () => {
  const s = (await post("/api/events", DECLINE)).body;
  assert.equal(active(s, "checkout_stuck"), undefined);
});

let stress;
await check("salary + rent + low balance opens cash_stress and mutes marketing", async () => {
  await post("/api/events", SALARY);
  await post("/api/events", RENT);
  const s = (await post("/api/events", LOW)).body;
  stress = active(s, "cash_stress");
  assert.ok(stress);
  assert.deepEqual(stress.signals.map((x) => x.type), ["salary_received", "rent_paid", "balance_low"]);
  assert.ok(s.marketingMutedUntil > Date.now() + 71 * 3600_000);
});

await check("balance at or above €150 does not match", async () => {
  await post("/api/actions", { kind: "reset" });
  await post("/api/events", SALARY);
  await post("/api/events", RENT);
  const s = (await post("/api/events", { type: "balance_low", payload: { balanceEur: 150 } })).body;
  assert.equal(active(s, "cash_stress"), undefined);
});

await check("dismiss forever blocks the situation type from firing again", async () => {
  await post("/api/actions", { kind: "reset" });
  for (const e of [SALARY, RENT, LOW]) await post("/api/events", e);
  stress = active(await get(), "cash_stress");
  let s = (await post("/api/actions", { kind: "cta", situationId: stress.id, action: "dismiss_forever" })).body;
  assert.deepEqual(s.prefs.dismissedForever, ["cash_stress"]);
  for (const e of [SALARY, RENT, LOW]) s = (await post("/api/events", e)).body;
  assert.equal(active(s, "cash_stress"), undefined);
});

await check("pause Mee suppresses new situations and logs it", async () => {
  await post("/api/actions", { kind: "reset" });
  await post("/api/actions", { kind: "pause_mee", paused: true });
  await post("/api/events", DECLINE);
  const s = (await post("/api/events", DECLINE)).body;
  assert.equal(s.situations.length, 0);
  assert.ok(s.timeline.some((e) => e.text.en === "Rule matched (Checkout stuck), but the customer paused it. Nothing shown."));
});

await check("pausing Mee closes the open situation without a cooldown, and resume re-arms it", async () => {
  await post("/api/actions", { kind: "reset" });
  await post("/api/events", DECLINE);
  let s = (await post("/api/events", DECLINE)).body;
  const id = active(s, "checkout_stuck").id;
  s = (await post("/api/actions", { kind: "pause_mee", paused: true })).body;
  assert.equal(s.situations.find((x) => x.id === id).status, "suppressed");
  s = (await post("/api/events", DECLINE)).body;
  s = (await post("/api/events", DECLINE)).body;
  assert.equal(active(s, "checkout_stuck"), undefined);
  assert.ok(s.timeline.some((e) => e.text.en === "Rule matched (Checkout stuck), but the customer paused it. Nothing shown."));
  await post("/api/actions", { kind: "pause_mee", paused: false });
  await post("/api/events", DECLINE);
  s = (await post("/api/events", DECLINE)).body;
  assert.ok(active(s, "checkout_stuck"));
});

await check("pause this type closes the active one and keeps the other type armed", async () => {
  await post("/api/actions", { kind: "reset" });
  await post("/api/events", DECLINE);
  await post("/api/events", DECLINE);
  let s = (await post("/api/actions", { kind: "pause_type", situationType: "checkout_stuck", paused: true })).body;
  assert.equal(active(s, "checkout_stuck"), undefined);
  for (const e of [SALARY, RENT, LOW]) s = (await post("/api/events", e)).body;
  assert.ok(active(s, "cash_stress"));
});

await check("invalid event bodies are rejected at the boundary", async () => {
  assert.equal((await post("/api/events", { type: "keystroke_rage", payload: {} })).status, 400);
});

await post("/api/actions", { kind: "reset" });
console.log(`\n${checks.length} checks passed against ${BASE}`);
