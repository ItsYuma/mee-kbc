import { PLAYBOOKS } from "@/domain/playbooks";
import { getState } from "@/server/store";
import { parseBody, ttsInput } from "@/server/parse";

const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const MODEL_ID = "eleven_multilingual_v2";

const g = globalThis as unknown as { __meeTtsCache?: Map<string, ArrayBuffer> };
const cache = (g.__meeTtsCache ??= new Map());

export async function POST(req: Request) {
  const body = await parseBody(req, ttsInput);
  if (!body.ok) return body.res;
  const { situationId, channel, lang } = body.data;

  const situation = getState().situations.find((s) => s.id === situationId);
  if (!situation) return Response.json({ error: "unknown_situation" }, { status: 404 });

  const action = PLAYBOOKS[situation.type][channel];
  const text = action.scriptText[lang];
  const meta = { text, version: action.version };

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return Response.json({ mode: "mock", reason: "ELEVENLABS_API_KEY not set", ...meta });

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const key = `${voiceId}:${lang}:${text}`;
  let audio = cache.get(key);
  if (!audio) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: { stability: 0.6, similarity_boost: 0.75 } }),
    }).catch((e: Error) => e);
    if (res instanceof Error || !res.ok) {
      const reason = res instanceof Error ? res.message : `ElevenLabs ${res.status}: ${await res.text()}`;
      return Response.json({ mode: "mock", reason, ...meta });
    }
    audio = await res.arrayBuffer();
    cache.set(key, audio);
  }

  return new Response(audio, {
    headers: { "Content-Type": "audio/mpeg", "X-Mee-Voice": "elevenlabs", "X-Mee-Script-Version": encodeURIComponent(action.version) },
  });
}
