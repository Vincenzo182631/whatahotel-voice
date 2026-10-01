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
