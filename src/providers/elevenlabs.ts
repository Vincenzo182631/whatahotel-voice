import { concatMp3 } from "./audio.js";
import {
  applyPronunciations,
  requireEnv,
  type DialogueLine,
  type Pronunciation,
  type SynthesisResult,
  type VoiceProvider,
} from "./types.js";

// The streaming variant: same request and output, but audio starts flowing at once,
// so long dialogues are not cut off by proxies with a 30-second response timeout.
const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-dialogue/stream?output_format=mp3_44100_128";
/** eleven_v3 by default; set ELEVENLABS_MODEL (for example eleven_v4) to compare models. */
const MODEL = process.env.ELEVENLABS_MODEL ?? "eleven_v3";
/** Documented per-request ceiling across all inputs[].text. */
const CHAR_LIMIT = 2000;

/** Splits at turn boundaries so each request stays under the character limit. */
export function chunkLines(lines: DialogueLine[], limit = CHAR_LIMIT): DialogueLine[][] {
  const chunks: DialogueLine[][] = [];
  let current: DialogueLine[] = [];
  let size = 0;
  for (const line of lines) {
    if (line.text.length > limit) throw new Error(`A single turn exceeds ${limit} characters`);
    if (size + line.text.length > limit && current.length) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(line);
    size += line.text.length;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

export class ElevenLabsProvider implements VoiceProvider {
  readonly name = "elevenlabs";
  /**
   * Optional: in the cloud environment the key is an API credential that the
   * egress proxy adds as `xi-api-key` for api.elevenlabs.io, so the code never
   * sees it. Locally, set ELEVENLABS_API_KEY instead.
   */
  private readonly apiKey = process.env.ELEVENLABS_API_KEY;
  private readonly voices = {
    advisor: requireEnv("ELEVENLABS_VOICE_ADVISOR"),
    traveler: requireEnv("ELEVENLABS_VOICE_TRAVELER"),
  };
  private readonly dictionaryId = process.env.ELEVENLABS_PRONUNCIATION_DICT_ID;

  async synthesize(lines: DialogueLine[], pronunciations: Pronunciation[]): Promise<SynthesisResult> {
    // With a dictionary, ElevenLabs handles pronunciation; otherwise respell in the text.
    const prepared = this.dictionaryId
      ? lines
      : lines.map((l) => ({ ...l, text: applyPronunciations(l.text, pronunciations) }));
    const segments: Buffer[] = [];
    for (const chunk of chunkLines(prepared)) segments.push(await this.request(chunk));
    return { audio: await concatMp3(segments, 0.15), model: MODEL };
  }

  private async request(lines: DialogueLine[]): Promise<Buffer> {
    const body = {
      model_id: MODEL,
      language_code: "en",
      inputs: lines.map((l) => ({ text: l.text, voice_id: this.voices[l.speaker] })),
      ...(this.dictionaryId && {
        pronunciation_dictionary_locators: [{ pronunciation_dictionary_id: this.dictionaryId }],
      }),
    };
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { ...(this.apiKey && { "xi-api-key": this.apiKey }), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
