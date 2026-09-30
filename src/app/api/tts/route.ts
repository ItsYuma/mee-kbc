import { agentScript, situationSlots } from "@/domain/engine";
import { APP_PLAYBOOKS, CLASSIC_IVR, VOICE_FLOWS } from "@/domain/playbooks";
import { fill } from "@/domain/rules";
import type { Lang, MeeState } from "@/domain/types";
import { getState } from "@/server/store";
import { parseBody, ttsInput, type TtsInput } from "@/server/parse";

const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const MODEL_ID = "eleven_multilingual_v2";

const g = globalThis as unknown as { __meeTtsCache?: Map<string, ArrayBuffer> };
const cache = (g.__meeTtsCache ??= new Map());

type Script = { text: string; lang: Lang; version: string };

function approvedScript(input: TtsInput, state: MeeState): Script | Response {
  switch (input.kind) {
    case "situation": {
      const situation = state.situations.find((s) => s.id === input.situationId);
      if (!situation) return Response.json({ error: "unknown_situation" }, { status: 404 });
      if (input.channel === "app") {
        const action = APP_PLAYBOOKS[situation.type];
        return { text: action.scriptText[input.lang], lang: input.lang, version: action.version };
      }
      const agent = agentScript(state, situation);
      return { text: fill(agent.whisper[input.lang], situationSlots(state, situation, input.lang)), lang: input.lang, version: agent.version };
    }
    case "turn": {
      const call = state.call?.id === input.callId ? state.call : null;
      const turn = call?.turns.find((t) => t.id === input.turnId);
      const situation = call && state.situations.find((s) => s.id === call.situationId);
      if (!call || !turn || !situation) return Response.json({ error: "unknown_turn" }, { status: 404 });
      if (turn.speaker !== "mee") return Response.json({ error: "not_a_mee_turn" }, { status: 400 });
      return { text: turn.text, lang: call.lang, version: VOICE_FLOWS[situation.type].version };
    }
    case "classic_ivr":
      return { text: CLASSIC_IVR[input.lang], lang: input.lang, version: "classic IVR · contrast only" };
  }
}

export async function POST(req: Request) {
  const body = await parseBody(req, ttsInput);
  if (!body.ok) return body.res;

  const script = approvedScript(body.data, getState());
  if (script instanceof Response) return script;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return Response.json({ mode: "mock", reason: "ELEVENLABS_API_KEY not set", ...script });

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const key = `${voiceId}:${script.lang}:${script.text}`;
  let audio = cache.get(key);
  if (!audio) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: script.text, model_id: MODEL_ID, voice_settings: { stability: 0.6, similarity_boost: 0.75 } }),
    }).catch((e: Error) => e);
    if (res instanceof Error || !res.ok) {
      const reason = res instanceof Error ? res.message : `ElevenLabs ${res.status}: ${await res.text()}`;
      return Response.json({ mode: "mock", reason, ...script });
    }
    audio = await res.arrayBuffer();
    cache.set(key, audio);
  }

  return new Response(audio, {
    headers: { "Content-Type": "audio/mpeg", "X-Mee-Voice": "elevenlabs", "X-Mee-Script-Version": encodeURIComponent(script.version) },
  });
}
