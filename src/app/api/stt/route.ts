import { liveCall } from "@/domain/engine";
import type { Lang } from "@/domain/types";
import { getState } from "@/server/store";
import { parseForm, sttInput } from "@/server/parse";

type Provider = {
  mode: "elevenlabs" | "openai";
  transcribe: (audio: Blob, lang: Lang) => Promise<Response>;
};

const fileName = (audio: Blob) => (audio instanceof File && audio.name ? audio.name : "speech.webm");

function provider(): Provider | null {
  const eleven = process.env.ELEVENLABS_API_KEY;
  if (eleven) {
    return {
      mode: "elevenlabs",
      transcribe: (audio, lang) => {
        const form = new FormData();
        form.set("file", audio, fileName(audio));
        form.set("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v2");
        form.set("language_code", lang);
        form.set("tag_audio_events", "false");
        return fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": eleven }, body: form });
      },
    };
  }
  const openai = process.env.OPENAI_API_KEY;
  if (openai) {
    return {
      mode: "openai",
      transcribe: (audio, lang) => {
        const form = new FormData();
        form.set("file", audio, fileName(audio));
        form.set("model", "whisper-1");
        form.set("language", lang);
        return fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${openai}` }, body: form });
      },
    };
  }
  return null;
}

export function GET() {
  return Response.json({ mode: provider()?.mode ?? "mock" });
}

export async function POST(req: Request) {
  const body = await parseForm(req, sttInput);
  if (!body.ok) return body.res;
  const { audio, callId, lang } = body.data;

  if (liveCall(getState())?.id !== callId) return Response.json({ error: "no_live_call" }, { status: 409 });

  const stt = provider();
  if (!stt) return Response.json({ mode: "mock", reason: "no speech-to-text key set" });

  const res = await stt.transcribe(audio, lang).catch((e: Error) => e);
  if (res instanceof Error || !res.ok) {
    const reason = res instanceof Error ? res.message : `${stt.mode} ${res.status}: ${await res.text()}`;
    return Response.json({ mode: "mock", reason });
  }
  const json = (await res.json()) as { text?: unknown };
  return Response.json({ mode: stt.mode, text: typeof json.text === "string" ? json.text.trim() : "" });
}
