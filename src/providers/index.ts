import { WORDS_PER_SECOND } from "../script/rules.js";
import { concatMp3, tone } from "./audio.js";
import { ElevenLabsProvider } from "./elevenlabs.js";
import { GeminiProvider } from "./gemini.js";
import type { DialogueLine, SynthesisResult, VoiceProvider } from "./types.js";

/**
 * Offline stand-in: one tone per turn, timed to the words, different pitch per host.
 * Lets the whole pipeline (storage, review, player) run without API keys.
 */
export class MockProvider implements VoiceProvider {
  readonly name = "mock";
  async synthesize(lines: DialogueLine[]): Promise<SynthesisResult> {
    const segments: Buffer[] = [];
    for (const line of lines) {
      const words = line.text.split(/\s+/).filter(Boolean).length;
      const seconds = Math.max(0.5, Math.round((words / WORDS_PER_SECOND) * 10) / 10);
      segments.push(await tone(seconds, line.speaker === "advisor" ? 220 : 330));
    }
    return { audio: await concatMp3(segments), model: "tone" };
  }
}

export const PROVIDERS = ["mock", "elevenlabs", "gemini"] as const;
export type ProviderName = (typeof PROVIDERS)[number];

export function createProvider(name: string): VoiceProvider {
  switch (name) {
    case "mock":
      return new MockProvider();
    case "elevenlabs":
      return new ElevenLabsProvider();
    case "gemini":
      return new GeminiProvider();
    default:
      throw new Error(`Unknown provider "${name}". Use one of: ${PROVIDERS.join(", ")}`);
  }
}
