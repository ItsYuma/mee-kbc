import assert from "node:assert/strict";

const BASE = process.env.MEE_URL ?? "http://127.0.0.1:4317";

const parse = async (res) => ({
  status: res.status,
  type: res.headers.get("content-type"),
  body: res.headers.get("content-type")?.includes("json") ? await res.json() : null,
});
const post = async (path, body) =>
  parse(await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
const postForm = async (path, form) => parse(await fetch(BASE + path, { method: "POST", body: form }));
const get = async () => (await fetch(BASE + "/api/situation")).json();
const act = async (body) => (await post("/api/actions", body)).body;
const fire = async (signal) => (await post("/api/events", signal)).body;
const active = (s, type) => s.situations.find((x) => x.status === "active" && x.type === type);
const status = (s, id) => s.situations.find((x) => x.id === id).status;
const say = (call, text, source = "quick_reply") => act({ kind: "customer_said", callId: call.id, text, source });
const lastMee = (s) => s.call.turns.findLast((t) => t.speaker === "mee");
const reset = () => act({ kind: "reset" });

const DECLINE = { type: "payment_declined", payload: { merchant: "Delhaize Korenmarkt", amountEur: 42.6, scheme: "Bancontact", code: "65", city: "Gent" } };
const SALARY = { type: "salary_received", payload: { employer: "Studio Noord BV", amountEur: 2140 } };
const RENT = { type: "rent_paid", payload: { payee: "Immo Vandenbroucke", amountEur: 1150 } };
const LOW = { type: "balance_low", payload: { balanceEur: 84.3 } };
const BLOCK = (countryCode, city) => ({
  type: "card_blocked",
  payload: { card: "•• 4821", merchant: "Pingo Doce Chiado", amountEur: 63.4, city, countryCode, reason: "geo_velocity" },
});

const eurFr = (n) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(n);

const checks = [];
const check = async (name, fn) => {
  await fn();
  checks.push(name);
  console.log(`ok  ${name}`);
};

async function cardCall(lang = "fr") {
  await reset();
  const s = await fire(BLOCK("PT", "Lisboa"));
  const sit = active(s, "card_blocked_abroad");
  const called = await act({ kind: "cta", situationId: sit.id, action: "talk_to_mee", lang });
  return { sit, call: called.call, state: called };
}

async function stuckSituation() {
  await reset();
  await fire(DECLINE);
  return active(await fire(DECLINE), "checkout_stuck");
}

// Journey 1 · checkout stuck

await reset();

await check("one decline does not open a situation", async () => {
  const s = await fire(DECLINE);
  assert.equal(s.situations.length, 0);
});

let stuck;
await check("second decline opens checkout_stuck with both signals", async () => {
  const s = await fire(DECLINE);
  stuck = active(s, "checkout_stuck");
  assert.ok(stuck);
  assert.equal(stuck.signals.length, 2);
});

await check("a third decline does not open a second nudge", async () => {
  const s = await fire(DECLINE);
  assert.equal(s.situations.filter((x) => x.type === "checkout_stuck").length, 1);
});

await check("TTS speaks only the approved app script, in French too", async () => {
  const en = await post("/api/tts", { kind: "situation", situationId: stuck.id, channel: "app", lang: "en" });
  assert.equal(en.status, 200);
  if (en.body) {
    assert.equal(en.body.mode, "mock");
    assert.equal(en.body.text, "Your card is fine, you just hit the contactless limit, so pay with Payconiq and you're through in one tap.");
    const fr = await post("/api/tts", { kind: "situation", situationId: stuck.id, channel: "app", lang: "fr" });
    assert.equal(fr.body.text, "Votre carte fonctionne, vous avez juste atteint le plafond sans contact, alors payez avec Payconiq et c'est réglé en un geste.");
  } else {
    assert.equal(en.type, "audio/mpeg");
  }
});

await check("TTS agent whisper is the filled approved template", async () => {
  const r = await post("/api/tts", { kind: "situation", situationId: stuck.id, channel: "agent", lang: "fr" });
  if (r.body) {
    assert.equal(r.body.text, "Lotte a eu deux refus Bancontact chez Delhaize Korenmarkt à cause du plafond sans contact, la carte fonctionne, ne demandez pas les données de la carte.");
  }
});

await check("TTS rejects free text, unknown situations and bad bodies", async () => {
  assert.equal((await post("/api/tts", { kind: "situation", situationId: stuck.id, channel: "app", lang: "fr", text: "Achetez notre carte premium !" })).status, 400);
  assert.equal((await post("/api/tts", { text: "Buy our premium card!" })).status, 400);
  assert.equal((await post("/api/tts", { kind: "situation", situationId: "nope", channel: "app", lang: "fr" })).status, 404);
  assert.equal((await post("/api/tts", { kind: "situation", situationId: stuck.id, channel: "sms", lang: "fr" })).status, 400);
});

await check("classic_ivr returns the fixed old phone-menu line", async () => {
  const r = await post("/api/tts", { kind: "classic_ivr", lang: "fr" });
  assert.equal(r.status, 200);
  if (r.body) assert.ok(r.body.text.startsWith("Bienvenue à la banque. Pour les cartes, tapez 1."));
});

await check("Payconiq CTA resolves via a payment_succeeded signal", async () => {
  const s = await act({ kind: "cta", situationId: stuck.id, action: "pay_with_payconiq", lang: "fr" });
  assert.equal(status(s, stuck.id), "resolved");
  assert.equal(s.signals.at(-1).type, "payment_succeeded");
  assert.equal(s.signals.at(-1).payload.method, "Payconiq");
});

await check("old declines are consumed and do not re-fire after resolve", async () => {
  const s = await fire(DECLINE);
  assert.equal(active(s, "checkout_stuck"), undefined);
});

await check("talk_to_mee on checkout_stuck greets with filled slots", async () => {
  const sit = await stuckSituation();
  const s = await act({ kind: "cta", situationId: sit.id, action: "talk_to_mee", lang: "fr" });
  assert.equal(s.call.phase, "with_mee");
  assert.equal(s.call.situationId, sit.id);
  const greeting = s.call.turns[0];
  assert.equal(greeting.speaker, "mee");
  assert.ok(greeting.text.startsWith("Bonjour Lotte, c'est Mee."));
  assert.ok(greeting.text.includes("Delhaize Korenmarkt"));
  assert.ok(greeting.text.includes(eurFr(42.6)));
  assert.ok(!greeting.text.includes("{"));
});

await check("FR 'Oui, envoyez-moi le lien Payconiq' pays, resolves and ends the call", async () => {
  const { call } = await get();
  const s = await say(call, "Oui, envoyez-moi le lien Payconiq.");
  assert.equal(s.signals.at(-1).type, "payment_succeeded");
  assert.equal(status(s, call.situationId), "resolved");
  assert.equal(s.call.phase, "ended");
  assert.equal(lastMee(s).text, "C'est fait. Le lien Payconiq est sur votre écran, scannez-le à la caisse et c'est réglé.");
});

await check("FR 'Je préfère parler à quelqu'un' on checkout hands off to Anouk", async () => {
  const sit = await stuckSituation();
  const { call } = await act({ kind: "cta", situationId: sit.id, action: "talk_to_mee", lang: "fr" });
  const s = await say(call, "Je préfère parler à quelqu'un.");
  assert.equal(s.call.phase, "with_agent");
  assert.ok(s.call.handedOffAt);
  assert.equal(lastMee(s).text, "Anouk prend l'appel. Elle sait déjà ce qui s'est passé, vous n'aurez rien à réexpliquer.");
  assert.equal(status(s, sit.id), "active");
});

await check("customer turns during with_agent are appended without matching", async () => {
  const { call } = await get();
  const s = await say(call, "Oui, envoyez-moi le lien Payconiq.", "speech");
  assert.equal(s.call.phase, "with_agent");
  assert.equal(s.call.turns.at(-1).speaker, "customer");
  assert.equal(s.call.turns.at(-1).matched, null);
  assert.equal(active(s, "checkout_stuck").id, call.situationId);
});

await check("agent_resolve resolves the situation and ends the call", async () => {
  const { call } = await get();
  const s = await act({ kind: "cta", situationId: call.situationId, action: "agent_resolve", lang: "fr" });
  assert.equal(status(s, call.situationId), "resolved");
  assert.equal(s.call.phase, "ended");
});

// Journey 3 · card blocked abroad

await check("card_blocked in BE does not open a situation", async () => {
  await reset();
  const s = await fire(BLOCK("BE", "Gent"));
  assert.equal(s.situations.length, 0);
});

await check("card_blocked in PT opens card_blocked_abroad", async () => {
  const s = await fire(BLOCK("PT", "Lisboa"));
  const sit = active(s, "card_blocked_abroad");
  assert.ok(sit);
  assert.deepEqual(sit.signals.map((x) => x.payload.countryCode), ["PT"]);
});

await check("unblock_card CTA in the app fires card_unblocked and resolves", async () => {
  const sit = active(await get(), "card_blocked_abroad");
  const s = await act({ kind: "cta", situationId: sit.id, action: "unblock_card", lang: "fr" });
  assert.equal(s.signals.at(-1).type, "card_unblocked");
  assert.equal(s.signals.at(-1).payload.card, "•• 4821");
  assert.equal(status(s, sit.id), "resolved");
});

let turnCall;
await check("talk_to_mee greeting contains the filled place, merchant and amount", async () => {
  const { call } = await cardCall("fr");
  turnCall = call;
  const text = call.turns[0].text;
  assert.equal(
    text,
    `Bonjour Lotte, c'est Mee. Je vois que votre carte •• 4821 a été suspendue après un paiement de ${eurFr(63.4)} chez Pingo Doce Chiado à Lisboa. Si c'était vous, je peux la débloquer tout de suite. C'était bien vous ?`,
  );
  assert.ok(text.includes("63,40"));
  assert.ok(!text.includes("{"));
});

await check("TTS turn returns the Mee turn text and rejects a customer turn with 400", async () => {
  const r = await post("/api/tts", { kind: "turn", callId: turnCall.id, turnId: turnCall.turns[0].id });
  assert.equal(r.status, 200);
  if (r.body) {
    assert.equal(r.body.text, turnCall.turns[0].text);
    assert.equal(r.body.lang, "fr");
  }
  const s = await say(turnCall, "euh");
  const customerTurn = s.call.turns.find((t) => t.speaker === "customer");
  assert.equal((await post("/api/tts", { kind: "turn", callId: turnCall.id, turnId: customerTurn.id })).status, 400);
  assert.equal((await post("/api/tts", { kind: "turn", callId: turnCall.id, turnId: "nope" })).status, 404);
});

await check("FR 'Oui, c'était moi' unblocks, resolves and ends the call", async () => {
  const { sit, call } = await cardCall("fr");
  const s = await say(call, "Oui, c'était moi.");
  assert.equal(s.call.turns.at(-2).matched, "unblock");
  assert.equal(s.signals.at(-1).type, "card_unblocked");
  assert.equal(status(s, sit.id), "resolved");
  assert.equal(s.call.phase, "ended");
  assert.equal(lastMee(s).text, "Merci. Votre carte est débloquée, réessayez le paiement, il passera.");
});

await check("FR 'Non, ce n'était pas moi' hands off and keeps the card blocked", async () => {
  const { sit, call } = await cardCall("fr");
  const s = await say(call, "Non, ce n'était pas moi.", "speech");
  assert.equal(s.call.turns.find((t) => t.speaker === "customer").matched, "not_me");
  assert.equal(s.call.phase, "with_agent");
  assert.equal(s.call.handoffReason, "not_me");
  assert.equal(status(s, sit.id), "active");
  assert.ok(!s.signals.some((x) => x.type === "card_unblocked"));
});

await check("a fraud handoff gives the agent the keep-blocked script, not the unblock one", async () => {
  const { call } = await get();
  const r = await post("/api/tts", { kind: "situation", situationId: call.situationId, channel: "agent", lang: "fr" });
  if (r.body) {
    assert.equal(
      r.body.text,
      `Lotte dit que le paiement de ${eurFr(63.4)} chez Pingo Doce Chiado à Lisboa n'était pas d'elle, gardez la carte •• 4821 bloquée, ouvrez un dossier fraude et commandez une nouvelle carte, sans lui faire répéter ce qui s'est passé.`,
    );
  }
  const other = await cardCall("fr");
  await say(other.call, "Je préfère parler à quelqu'un.");
  const h = await post("/api/tts", { kind: "situation", situationId: other.sit.id, channel: "agent", lang: "fr" });
  if (h.body) assert.ok(h.body.text.includes("vérifiez-la avec itsme, débloquez"));
});

await check("'je ne veux pas débloquer' does NOT unblock", async () => {
  const { sit, call } = await cardCall("fr");
  const s = await say(call, "je ne veux pas débloquer", "speech");
  assert.equal(s.call.turns.at(-2).matched, null);
  assert.equal(s.call.misses, 1);
  assert.equal(s.call.phase, "with_mee");
  assert.equal(status(s, sit.id), "active");
  assert.ok(!s.signals.some((x) => x.type === "card_unblocked"));
  assert.equal(lastMee(s).text, "Pardon, je n'ai pas compris. Le paiement à Lisboa, c'était vous, oui ou non ?");
});

await check("two unmatched answers hand off automatically", async () => {
  const { call } = await get();
  const s = await say(call, "le chat est sur la table", "speech");
  assert.equal(s.call.misses, 2);
  assert.equal(s.call.phase, "with_agent");
  assert.ok(lastMee(s).text.startsWith("Anouk prend l'appel."));
});

await check("NL 'Ik spreek liever iemand' hands off", async () => {
  const { call } = await cardCall("nl");
  assert.ok(call.turns[0].text.startsWith("Hoi Lotte, met Mee."));
  const s = await say(call, "Ik spreek liever iemand", "speech");
  assert.equal(s.call.phase, "with_agent");
  assert.equal(lastMee(s).text, "Anouk neemt op. Ze weet al wat er gebeurde, dus je hoeft niets opnieuw uit te leggen.");
});

await check("end_call ends the call and keeps the situation open", async () => {
  const { sit, call } = await cardCall("fr");
  const s = await act({ kind: "end_call", callId: call.id });
  assert.equal(s.call.phase, "ended");
  assert.equal(status(s, sit.id), "active");
  const after = await say(call, "Oui, c'était moi.");
  assert.equal(status(after, sit.id), "active");
});

await check("pausing Mee ends any call", async () => {
  const { call } = await cardCall("fr");
  assert.equal(call.phase, "with_mee");
  const s = await act({ kind: "pause_mee", paused: true });
  assert.equal(s.call.phase, "ended");
  assert.equal(active(s, "card_blocked_abroad"), undefined);
});

await check("STT validates the boundary and returns mock without keys", async () => {
  const { call } = await cardCall("fr");
  const form = () => {
    const f = new FormData();
    f.set("audio", new Blob([new Uint8Array(2048)], { type: "audio/webm" }), "speech.webm");
    f.set("lang", "fr");
    return f;
  };
  const ok = form();
  ok.set("callId", call.id);
  const r = await postForm("/api/stt", ok);
  assert.equal(r.status, 200);
  if (r.body.mode === "mock") assert.equal(r.body.text, undefined);
  else assert.equal(typeof r.body.text, "string");

  const wrongCall = form();
  wrongCall.set("callId", "call-nope");
  assert.equal((await postForm("/api/stt", wrongCall)).status, 409);

  const noAudio = new FormData();
  noAudio.set("callId", call.id);
  noAudio.set("lang", "fr");
  assert.equal((await postForm("/api/stt", noAudio)).status, 400);

  const badLang = form();
  badLang.set("callId", call.id);
  badLang.set("lang", "de");
  assert.equal((await postForm("/api/stt", badLang)).status, 400);
});

await check("customer_said is validated at the boundary", async () => {
  const { call } = await get();
  assert.equal((await post("/api/actions", { kind: "customer_said", callId: call.id, text: "", source: "speech" })).status, 400);
  assert.equal((await post("/api/actions", { kind: "customer_said", callId: call.id, text: "oui", source: "llm" })).status, 400);
  assert.equal((await post("/api/actions", { kind: "cta", situationId: call.situationId, action: "call_support", lang: "fr" })).status, 400);
});

// Journey 2 · cash stress and privacy

let stress;
await check("salary + rent + low balance opens cash_stress and mutes marketing", async () => {
  await reset();
  await fire(SALARY);
  await fire(RENT);
  const s = await fire(LOW);
  stress = active(s, "cash_stress");
  assert.ok(stress);
  assert.deepEqual(stress.signals.map((x) => x.type), ["salary_received", "rent_paid", "balance_low"]);
  assert.ok(s.marketingMutedUntil > Date.now() + 71 * 3600_000);
});

await check("balance at or above €150 does not match", async () => {
  await reset();
  await fire(SALARY);
  await fire(RENT);
  const s = await fire({ type: "balance_low", payload: { balanceEur: 150 } });
  assert.equal(active(s, "cash_stress"), undefined);
});

await check("dismiss forever blocks the situation type from firing again", async () => {
  await reset();
  for (const e of [SALARY, RENT, LOW]) await fire(e);
  stress = active(await get(), "cash_stress");
  let s = await act({ kind: "cta", situationId: stress.id, action: "dismiss_forever", lang: "fr" });
  assert.deepEqual(s.prefs.dismissedForever, ["cash_stress"]);
  for (const e of [SALARY, RENT, LOW]) s = await fire(e);
  assert.equal(active(s, "cash_stress"), undefined);
});

await check("pause Mee suppresses new situations and logs it", async () => {
  await reset();
  await act({ kind: "pause_mee", paused: true });
  await fire(DECLINE);
  const s = await fire(DECLINE);
  assert.equal(s.situations.length, 0);
  assert.ok(s.timeline.some((e) => e.text.en === "Rule matched (Checkout stuck), but the customer paused it. Nothing shown."));
  assert.ok(s.timeline.some((e) => e.text.fr === "La règle a matché (Paiement bloqué), mais la cliente l'a mise en pause. Rien affiché."));
});

await check("pausing Mee closes the open situation without a cooldown, and resume re-arms it", async () => {
  const id = (await stuckSituation()).id;
  let s = await act({ kind: "pause_mee", paused: true });
  assert.equal(status(s, id), "suppressed");
  await fire(DECLINE);
  s = await fire(DECLINE);
  assert.equal(active(s, "checkout_stuck"), undefined);
  await act({ kind: "pause_mee", paused: false });
  await fire(DECLINE);
  s = await fire(DECLINE);
  assert.ok(active(s, "checkout_stuck"));
});

await check("pause this type closes the active one and keeps the other types armed", async () => {
  await stuckSituation();
  let s = await act({ kind: "pause_type", situationType: "checkout_stuck", paused: true });
  assert.equal(active(s, "checkout_stuck"), undefined);
  for (const e of [SALARY, RENT, LOW]) s = await fire(e);
  assert.ok(active(s, "cash_stress"));
  s = await fire(BLOCK("PT", "Lisboa"));
  assert.ok(active(s, "card_blocked_abroad"));
});

await check("invalid event bodies are rejected at the boundary", async () => {
  assert.equal((await post("/api/events", { type: "keystroke_rage", payload: {} })).status, 400);
  assert.equal((await post("/api/events", { type: "card_blocked", payload: { card: "x", merchant: "y", amountEur: 1, city: "z", countryCode: "portugal", reason: "r" } })).status, 400);
});

await reset();
console.log(`\n${checks.length} checks passed against ${BASE}`);
