# Mee · the bank that moves with you

Hackathon proof of concept for a retail bank. Mee notices a customer's situation from a few everyday signals, shows up once with one approved next step, speaks that same approved line through ElevenLabs, and hands the same situation to a contact-center agent. Then it goes quiet.

There is no LLM anywhere. Recognition is deterministic rules. Adaptation is versioned playbooks with fixed Dutch and English copy. Voice is text-to-speech of those fixed scripts only.

## Run it

```bash
npm install
npm run dev          # http://localhost:4317
```

Open `http://localhost:4317` for the demo stage, which shows the simulator, the customer phone, and the agent desk side by side. `/customer` and `/agent` open each view on its own, so you can put the phone view on a real phone and the agent desk on a second screen. All views share one in-memory store and poll it every 900 ms.

`npm run verify` runs an end-to-end check of both journeys, the privacy controls, and the TTS boundary against the running server (`MEE_URL` overrides the base URL).

## ElevenLabs

Without a key, the app runs in mock voice mode. `/api/tts` returns the approved script text and the browser speaks it with the Web Speech API. The UI labels this "Browser voice (mock)".

To use real ElevenLabs voices, create `.env.local`:

```bash
ELEVENLABS_API_KEY=sk_...
# optional, defaults to a premade multilingual voice
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb
```

Restart `npm run dev`. The route calls `eleven_multilingual_v2`, caches audio per script and language in memory, and falls back to mock mode if ElevenLabs returns an error. The UI then shows "Voice by ElevenLabs".

`/api/tts` accepts only `{ situationId, channel, lang }`. It looks up the script from the playbook itself, so no caller can make Mee say words that were not approved.

## How to demo (under 2 minutes)

1. **Fire the event.** In the simulator, click **Fire decline ×2**. Two Bancontact declines at Delhaize land within seconds.
2. **The moment.** Rule `R-PAY-01` fires `checkout_stuck`. The phone shows a "Mee · now" banner and a recovery sheet, and the approved one-sentence line plays automatically.
3. **Call support.** Tap **Call support** on the phone. The agent desk turns green with an incoming call and already shows the same situation ID, the same customer words as a readback, a whisper for the agent's ear, and a "don't re-ask" list.
4. **Play the whisper.** Click **Play whisper** on the agent desk.
5. **Explain.** On the phone, tap **Why am I seeing this?** The drawer shows the plain-language reason from the rule, the exact signals used, what Mee never uses, the rule ID, and the script version.
6. **Pause.** Flip **Pause Mee everywhere** in the drawer. The rule badges in the simulator switch to "paused". Fire another decline and the timeline records that the rule matched but nothing was shown.

Second journey. Click **Reset demo**, then **Play full pattern** under Cash stress. Salary, rent, and a balance of €84.30 arrive in sequence. Rule `R-BUF-02` opens `cash_stress` as a quiet inline card with an optional voice note (soft urgency means no banner and no autoplay). The promo slot flips to "Offers paused for 72h". Tap **Don't show this again** and the rule badge reads "dismissed ∞".

Toggle **NL / EN** in the top bar at any point. Every script exists in both languages.

## How it works

The domain lives in `src/domain` and is pure TypeScript with no framework imports.

- `types.ts` defines `Signal`, `Situation`, `PlaybookAction`, and the `MeeCommand` union that every change goes through.
- `rules.ts` is a registry keyed by situation type. Each rule owns its matching window, lifetime, dismiss cooldown, resolving signals, plain-language explanation, and the facts an agent should not re-ask.
- `playbooks.ts` is a registry of approved, versioned scripts per situation type and channel (`app`, `agent`).
- `engine.ts` is a reducer `(state, command, { now, id }) => state`. Situations move through a transition table (`active` to `resolved`, `dismissed`, or `expired`). A rule never fires while the same type is active, dismissed forever, cooling down after a dismiss, or paused. Signals from before a situation closed are not reused.

`src/server/store.ts` keeps one state object in memory. Route handlers in `src/app/api` validate input with zod and dispatch commands.

| Route | Purpose |
| --- | --- |
| `POST /api/events` | Ingest a mock signal (`payment_declined`, `salary_received`, …) |
| `GET /api/situation` | Current state, with expiry applied |
| `POST /api/actions` | Customer and agent actions: CTAs, pause, why opened, reset |
| `POST /api/tts` | Speak the approved script for a situation and channel |

Adding a situation means one entry in `RULES`, one in `PLAYBOOKS`, and a label. No new branches in the engine.

## Out of scope

No CRM, no auth, no database (state resets when the server restarts), no real banking APIs, no generative chat or next-best-action, no social or behavioral-biometric signals. Branding is a generic "demo bank", not a clone of any real bank.
