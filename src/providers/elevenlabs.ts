import { concatMp3 } from "./audio.js";
import type { Speaker } from "../core/schema.js";
import {
  applyPronunciations,
  GLOBAL_PRONUNCIATIONS,
  type DialogueLine,
  type Pronunciation,
  type SynthesisResult,
  type VoiceProvider,
} from "./types.js";

// The streaming variant: same request and output, but audio starts flowing at once,
// so long dialogues are not cut off by proxies with a 30-second response timeout.
const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-dialogue/stream?output_format=mp3_44100_128";
/** eleven_v4 by default (chosen over eleven_v3 on 2026-10-02); set ELEVENLABS_MODEL to compare models. */
const MODEL = process.env.ELEVENLABS_MODEL ?? "eleven_v4";
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

/**
 * The hosts' voices (ElevenLabs premade voices, chosen by ear 2026-10-05): Luxury Advisor = Eric
 * ("Smooth, Trustworthy"), Candid Traveler = Jessica ("Playful, Bright, Warm"). An environment
 * variable overrides a default, so remove stale ELEVENLABS_VOICE_* settings; the voice ids actually
 * used are recorded in each clip's metadata.json.
 */
export const DEFAULT_VOICES: Record<Speaker, string> = {
  advisor: "cjVigY5qzO86Huf0OWal",
  traveler: "cgSgspJ2msm6clMCkdW9",
};

export class ElevenLabsProvider implements VoiceProvider {
  readonly name = "elevenlabs";
  /**
   * Optional: in the cloud environment the key is an API credential that the
   * egress proxy adds as `xi-api-key` for api.elevenlabs.io, so the code never
   * sees it. Locally, set ELEVENLABS_API_KEY instead.
   */
  private readonly apiKey = process.env.ELEVENLABS_API_KEY;
  readonly voices: Record<Speaker, string> = {
    advisor: process.env.ELEVENLABS_VOICE_ADVISOR || DEFAULT_VOICES.advisor,
    traveler: process.env.ELEVENLABS_VOICE_TRAVELER || DEFAULT_VOICES.traveler,
  };
  private readonly dictionaryId = process.env.ELEVENLABS_PRONUNCIATION_DICT_ID;

  async synthesize(lines: DialogueLine[], pronunciations: Pronunciation[]): Promise<SynthesisResult> {
    // With a dictionary, ElevenLabs handles the hotel's names; the global rules (the brand name) are
    // still respelled in the text so they never depend on the dictionary. Without one, respell everything.
    const rules = this.dictionaryId ? GLOBAL_PRONUNCIATIONS : pronunciations;
    const prepared = lines.map((l) => ({ ...l, text: applyPronunciations(l.text, rules) }));
    const segments: Buffer[] = [];
    for (const chunk of chunkLines(prepared)) segments.push(await this.request(chunk));
    return { audio: await concatMp3(segments, 0.15), model: MODEL, voices: this.voices };
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
