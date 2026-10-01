import { SPEAKERS } from "../core/schema.js";
import { toMp3 } from "./audio.js";
import {
  applyPronunciations,
  requireEnv,
  type DialogueLine,
  type Pronunciation,
  type SynthesisResult,
  type VoiceProvider,
} from "./types.js";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-3.8-flash-tts";

/** Speaker labels as Gemini sees them; must match speech_config.speakers. */
const LABEL = { advisor: "Advisor", traveler: "Traveler" } as const;

const STYLE = {
  advisor: "warm, assured luxury travel advisor talking to a client",
  traveler: "friendly, candid, slightly wry seasoned traveler",
} as const;

interface InteractionResponse {
  steps?: Array<{ content?: Array<{ type?: string; data?: string; mime_type?: string }> }>;
}

/** Last audio block in the response, per the Interactions API docs. */
export function extractAudio(json: InteractionResponse): { data: Buffer; mime: string } {
  const blocks = (json.steps ?? []).flatMap((s) => s.content ?? []).filter((c) => c.data);
  const last = blocks[blocks.length - 1];
  if (!last?.data) throw new Error("Gemini response contained no audio");
  return { data: Buffer.from(last.data, "base64"), mime: last.mime_type ?? "audio/wav" };
}

export class GeminiProvider implements VoiceProvider {
  readonly name = "gemini";
  private readonly apiKey = requireEnv("GEMINI_API_KEY");
  private readonly voices = {
    advisor: process.env.GEMINI_VOICE_ADVISOR ?? "Charon",
    traveler: process.env.GEMINI_VOICE_TRAVELER ?? "Aoede",
  };

  async synthesize(lines: DialogueLine[], pronunciations: Pronunciation[]): Promise<SynthesisResult> {
    const body = {
      model: MODEL,
      input: [
        {
          type: "user_input",
          content: lines.map((l) => ({
            type: "text",
            text: applyPronunciations(l.text, pronunciations),
            annotations: [{ type: "speech_metadata", speaker: LABEL[l.speaker], style: STYLE[l.speaker] }],
          })),
        },
      ],
      response_format: { type: "audio" },
      generation_config: {
        speech_config: {
          mode: "conversational",
          speakers: (Object.keys(SPEAKERS) as Array<keyof typeof SPEAKERS>).map((s) => ({
            speaker: LABEL[s],
            voice: this.voices[s],
          })),
        },
      },
    };
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "x-goog-api-key": this.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const { data, mime } = extractAudio((await res.json()) as InteractionResponse);
    // Default output is a 24 kHz mono 16-bit WAV; raw L16 is only used when streaming.
    const isRawPcm = /l16|pcm/i.test(mime);
    return { audio: await toMp3(isRawPcm ? wrapPcm(data) : data, "wav"), model: MODEL };
  }
}

/** Adds a WAV header to raw 24 kHz mono s16le PCM. */
function wrapPcm(pcm: Buffer, sampleRate = 24000): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
