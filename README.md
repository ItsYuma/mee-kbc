# Mee · la banque qui bouge avec vous

Proof of concept de hackathon pour une banque de détail belge. Mee remarque la situation d'une cliente à partir de quelques signaux du quotidien, apparaît une seule fois avec une seule étape approuvée, la dit à voix haute, décroche quand la cliente l'appelle, comprend sa réponse par mots-clés, puis transfère l'appel à une conseillère qui sait déjà tout. Ensuite, il se tait.

Aucun LLM, nulle part. La reconnaissance des situations, ce sont des règles déterministes. Tout ce que Mee dit ou écrit vient de scripts approuvés et versionnés, dont les `{champs}` ne sont remplis qu'avec les données de l'événement. La transcription vocale sert uniquement de perception (audio vers texte) : c'est une table de mots-clés qui décide de la suite.

## Lancer

```bash
npm install
npm run dev          # http://localhost:4317
```

Node.js 20.9 ou plus récent est requis. Si la page reste blanche ou charge sans fin, un autre programme occupe sans doute le port 4317 (c'est aussi le port par défaut d'OpenTelemetry, utilisé par certains conteneurs Docker ou par le tableau de bord .NET Aspire) : lancez `npx next dev -p 4318` et ouvrez `http://localhost:4318`.

`http://localhost:4317` ouvre la scène de démo : simulateur, téléphone de la cliente et poste conseiller côte à côte. `/customer` et `/agent` ouvrent chaque vue seule, pour mettre le téléphone sur un vrai GSM et le poste conseiller sur un second écran. Toutes les vues partagent un même état en mémoire, interrogé toutes les 900 ms.

`npm run verify` rejoue les trois parcours, l'appel vocal, les contrôles de vie privée et les frontières TTS/STT contre le serveur lancé (`MEE_URL` change l'URL).

L'interface est en français par défaut. Le sélecteur FR · NL · EN en haut à droite change toute l'interface et tous les scripts.

## Démo en français (environ 3 minutes)

**Parcours 3 · Carte bloquée à l'étranger** (le plus fort pour commencer)

1. Dans le simulateur, cliquez **Carte bloquée à Lisbonne**. La règle `R-CRD-03` ouvre `card_blocked_abroad`. Le téléphone affiche « Nous avons suspendu votre carte par sécurité » et lit la phrase approuvée.
2. Montrez le contrôle : **Contrôle : bloquée à Gent** ne déclenche rien, parce que la règle ne vise que les blocages hors de Belgique.
3. Sur le téléphone, touchez **Parler à Mee**. L'écran d'appel s'ouvre et Mee dit : « Bonjour Lotte, c'est Mee. Je vois que votre carte •• 4821 a été suspendue après un paiement de 63,40 € chez Pingo Doce Chiado à Lisboa… C'était bien vous ? » Au même moment, le poste conseiller affiche « Mee est en ligne avec Lotte » et la transcription en direct.
4. Répondez au micro (« Oui, c'était moi ») ou touchez la réponse rapide **Oui, c'était moi.** La carte est débloquée, la situation se résout, l'appel se termine. Aucun conseiller n'a été nécessaire.

**Parcours 1 · Paiement refusé, avec transfert**

1. **Réinitialiser la démo**, puis **Refus ×2**. Deux refus Bancontact chez Delhaize déclenchent `R-PAY-01`.
2. **Parler à Mee**, puis **Je préfère parler à quelqu'un.** Le téléphone affiche « Anouk prend l'appel… elle sait déjà tout », puis « En ligne avec Anouk ».
3. Le poste conseiller montre l'appel entrant et une grande carte de situation : le lieu, la carte, le montant, l'action recommandée, depuis quand. Le bloc **À dire** se lit automatiquement une fois. **Ne pas redemander** liste ce qu'Anouk sait déjà, **Ce que Lotte a vu et entendu** montre le texte de l'app et tout l'appel.
4. **Marquer comme résolu** clôture la situation et l'appel.

Variante : dans le parcours 3, répondez **Non, ce n'était pas moi.** Mee garde la carte bloquée et transfère, et le poste conseiller reçoit le script fraude (garder bloquée, dossier fraude, nouvelle carte) au lieu du script de déblocage.

**Parcours 2 · Fin de mois serrée**

**Jouer le scénario complet** : salaire, loyer, puis un solde de 84,30 €. `R-BUF-02` ouvre une carte discrète dans l'app (urgence faible, donc ni bannière ni lecture automatique) et les offres marketing passent en pause 72 h.

**Pourquoi et pause.** Sur n'importe quelle carte, **Pourquoi je vois ceci ?** montre la raison en clair, les signaux utilisés, ce que Mee n'utilise jamais, l'ID de la règle et la version du script. **Mettre Mee en pause partout** coupe tout, y compris un appel en cours.

**Avant / après.** **Contraste : ancien serveur vocal** fait entendre le vieux menu « tapez 1, tapez 2… 14 minutes d'attente ». Enchaînez avec l'appel à Mee.

## Voix et transcription

Sans clé, tout fonctionne en mode démo :

- **Voix (TTS)** : `/api/tts` renvoie le texte approuvé et le navigateur le lit avec la synthèse vocale. L'interface indique « Voix du navigateur (démo) », ou « Pas de voix dans ce navigateur » si aucune voix n'existe.
- **Transcription (STT)** : `/api/stt` répond `{ mode: "mock" }`. Le téléphone utilise alors la reconnaissance vocale du navigateur (`webkitSpeechRecognition`, fr-BE / nl-BE / en-GB) si elle existe. Les réponses rapides sont toujours affichées, pour les salles bruyantes.

Pour les vraies voix et la vraie transcription, créez `.env.local` puis relancez `npm run dev` :

```bash
ELEVENLABS_API_KEY=sk_...
# optionnel : voix multilingue par défaut
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb
# optionnel : modèle de transcription, scribe_v2 par défaut (scribe_v1 a été retiré par ElevenLabs en juillet 2026)
ELEVENLABS_STT_MODEL=scribe_v2
# alternative pour la transcription si aucune clé ElevenLabs : OpenAI Whisper (whisper-1)
OPENAI_API_KEY=sk-...
```

Le choix du fournisseur se fait côté serveur : ElevenLabs Speech-to-Text si `ELEVENLABS_API_KEY` existe, sinon OpenAI Whisper si `OPENAI_API_KEY` existe, sinon le mode démo. Le téléphone enregistre alors avec `MediaRecorder` et affiche le niveau du micro.

## Garde-fous

- `/api/tts` n'accepte jamais de texte libre. Le corps est l'un de `{ kind: "situation", situationId, channel, lang }`, `{ kind: "turn", callId, turnId }` (uniquement les tours de Mee, sinon 400) ou `{ kind: "classic_ivr", lang }`. Le serveur retrouve lui-même le texte approuvé. Toute clé en plus est refusée.
- La transcription ne décide de rien. Le texte transcrit passe par `matchChoice` (`src/domain/voice.ts`) : une table de mots-clés par langue avec une fenêtre de négation (« je ne veux pas débloquer » ne débloque pas). Deux réponses non reconnues transfèrent vers un humain.
- Chaque suggestion garde « Pourquoi je vois ceci ? » et les contrôles de pause.

---

## English

Hackathon proof of concept for a Belgian retail bank. Mee notices a customer's situation from a few everyday signals, shows up once with one approved next step, speaks it, answers when the customer calls, understands the reply through a keyword table, and hands the call to an agent who already knows everything. Then it goes quiet.

There is no LLM anywhere. Recognition is deterministic rules. Every word Mee says or writes comes from approved, versioned templates whose `{slots}` are filled only from event data. Speech-to-text is perception only; a keyword table decides what happens.

### Run it

```bash
npm install
npm run dev          # http://localhost:4317
```

Requires Node.js 20.9 or newer. If the page stays blank or keeps loading, another program probably holds port 4317 (it is also the default OpenTelemetry port, used by some Docker containers and the .NET Aspire dashboard): run `npx next dev -p 4318` and open `http://localhost:4318`.

`/` is the demo stage (simulator, customer phone, agent desk). `/customer` and `/agent` open each view on its own. `npm run verify` runs the end-to-end checks against the running server. The UI defaults to French; the FR · NL · EN toggle switches all copy and scripts.

### Demo in English

1. **Card blocked abroad.** Click **Card blocked in Lisbon**. On the phone tap **Talk to Mee**, then say or tap **Yes, that was me.** The card is unblocked and the call ends without an agent. **Control: blocked in Gent** shows the rule ignoring a home-country block.
2. **Payment fail with handoff.** Reset, **Decline ×2**, **Talk to Mee**, then **I'd rather talk to someone.** The desk shows the incoming call, the situation card, the whisper under **Say this** (auto-played once), **Don't re-ask**, and **What Lotte saw and heard**. **Mark as fixed** resolves it.
3. **Cash stress.** **Play full pattern** opens a quiet inline card and mutes marketing for 72h.
4. **Why + pause.** **Why am I seeing this?** explains the rule, and **Pause Mee everywhere** stops all nudges and ends any call.
5. **Before/after.** **Contrast: old phone menu** plays the classic IVR line.

### Voice and transcription

Without keys everything runs in mock mode: browser speech synthesis for TTS, browser speech recognition when available for STT, and quick replies always. With `ELEVENLABS_API_KEY`, TTS uses `eleven_multilingual_v2` with an in-memory cache, and STT uses ElevenLabs Speech-to-Text (`ELEVENLABS_STT_MODEL`, default `scribe_v2`). Without an ElevenLabs key but with `OPENAI_API_KEY`, STT uses Whisper (`whisper-1`).

### How it works

The domain lives in `src/domain` and is pure TypeScript with no framework imports.

- `types.ts` defines signals, situations, playbooks, voice flows, calls and turns, and the `MeeCommand` union that every change goes through.
- `rules.ts` is a registry keyed by situation type. Each rule owns its matching window, lifetime, dismiss cooldown, resolving signals, slot extraction, templated explanation and structured facts per language.
- `playbooks.ts` holds the approved scripts: app nudges, agent whispers and recommended actions (with variants per handoff reason), voice flows (greeting, choices, not understood, handoff), the classic IVR line and situation labels.
- `voice.ts` normalizes text and matches it against a flow's keyword table with a negation window.
- `engine.ts` is a reducer `(state, command, { now, id }) => state`. Situations move through a transition table (`active` to `resolved`, `dismissed`, `suppressed` or `expired`). A call moves `with_mee` to `with_agent` to `ended`. A matched answer reuses the normal CTA path, so "yes, that was me" fires the same `card_unblocked` signal as the app button.

`src/server/store.ts` keeps one state object in memory. Route handlers in `src/app/api` validate input with zod and dispatch commands.

| Route | Purpose |
| --- | --- |
| `POST /api/events` | Ingest a mock signal (`payment_declined`, `card_blocked`, `salary_received`, …) |
| `GET /api/situation` | Current state, with expiry applied |
| `POST /api/actions` | CTAs (with language), `customer_said`, `end_call`, pause, why opened, reset |
| `POST /api/tts` | Speak an approved script: a situation line, a Mee call turn, or the classic IVR line |
| `GET /api/stt` | Which transcription provider is configured |
| `POST /api/stt` | Multipart `audio`, `callId`, `lang`; returns `{ mode, text }` or `{ mode: "mock" }` |

Adding a situation means one entry in `RULES`, `APP_PLAYBOOKS`, `AGENT_PLAYBOOKS`, `VOICE_FLOWS` and `SITUATION_LABEL`. No new branches in the engine.

### Out of scope

No CRM, no auth, no database (state resets when the server restarts), no real banking APIs, no generative chat or next-best-action, no social or behavioral-biometric signals. Branding is a generic demo bank.
