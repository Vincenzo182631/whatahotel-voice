import type { Speaker } from "../core/schema.js";

export interface DialogueLine {
  speaker: Speaker;
  text: string;
}

export interface Pronunciation {
  term: string;
  say_as: string;
}

export interface SynthesisResult {
  /** MP3, ready to store. */
  audio: Buffer;
  model: string;
}

/** Every TTS vendor sits behind this so hotels never depend on one provider. */
export interface VoiceProvider {
  readonly name: string;
  synthesize(lines: DialogueLine[], pronunciations: Pronunciation[]): Promise<SynthesisResult>;
}

/**
 * Applied to every clip for every hotel, ahead of the hotel's own list. "WhataHotel" is read as
 * one made-up word otherwise; "What a Hotel" is how it is said (approved by ear 2026-10-06).
 * Only the voiced text changes: transcripts and on-page text keep the brand spelling.
 */
export const GLOBAL_PRONUNCIATIONS: Pronunciation[] = [{ term: "WhataHotel", say_as: "What a Hotel" }];

/** The global rules first, then the hotel's own; a hotel entry for the same term replaces the global one. */
export function withGlobalPronunciations(own: Pronunciation[]): Pronunciation[] {
  const terms = new Set(own.map((p) => p.term));
  return [...GLOBAL_PRONUNCIATIONS.filter((g) => !terms.has(g.term)), ...own];
}

/** Rewrites hard names into phonetic spellings for providers without a dictionary. */
export function applyPronunciations(text: string, pronunciations: Pronunciation[]): string {
  return pronunciations.reduce((t, p) => {
    const escaped = p.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return t.replace(new RegExp(`\\b${escaped}\\b`, "g"), p.say_as);
  }, text);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. See .env.example.`);
  return value;
}
