import { readFile } from "node:fs/promises";
import { loadProfile } from "./core/profile.js";
import { ScriptSchema, type Metadata, type Script } from "./core/schema.js";
import { durationSeconds } from "./providers/audio.js";
import { createProvider } from "./providers/index.js";
import { withGlobalPronunciations } from "./providers/types.js";
import { SCRIPT_MODEL, factCheck, pipelineApiKey, writeScript } from "./script/claude.js";
import { AUDIO_SECONDS, checkDuration, checkScript, withSignature, wordCount } from "./script/rules.js";
import { nextVersion, readScript, saveVersion } from "./storage/local.js";

export interface GenerateOptions {
  provider: string;
  /** Reuse the script of an earlier version (e.g. to compare voice providers on identical text). */
  fromVersion?: number;
  /** Use a hand-written script file instead of calling Claude. */
  scriptFile?: string;
  /** Stop after the script; no audio. */
  scriptOnly?: boolean;
  log?: (msg: string) => void;
}

export interface GenerateResult {
  dir: string;
  metadata: Metadata;
  ruleIssues: string[];
}

const hasClaude = () => Boolean(pipelineApiKey());

export async function generateHotel(slug: string, opts: GenerateOptions): Promise<GenerateResult> {
  const log = opts.log ?? (() => {});
  const profile = await loadProfile(slug);

  const fresh = !opts.fromVersion && !opts.scriptFile;
  const MAX_ROUNDS = 2;
  let lengthFeedback: string[] = [];
  let script!: Script;
  let scriptModel = "";
  let fact!: Metadata["fact_check"];
  let ruleIssues: string[] = [];
  let audio: Buffer | undefined;
  let voiceModel = "none";
  let duration: number | null = null;
  let lengthIssue: string | null = null;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (opts.fromVersion) {
      script = await readScript(slug, opts.fromVersion);
      scriptModel = `reused:v${opts.fromVersion}`;
    } else if (opts.scriptFile) {
      script = ScriptSchema.parse(JSON.parse(await readFile(opts.scriptFile, "utf8")));
      scriptModel = "manual";
    } else {
      if (!hasClaude()) throw new Error("No WH_ANTHROPIC_API_KEY set. Use --script-file or --from-version, or add the key.");
      log(`writing script with ${SCRIPT_MODEL}…`);
      const result = await writeScript(profile, { feedback: lengthFeedback });
      script = result.script;
      scriptModel = SCRIPT_MODEL;
      log(`script ready after ${result.attempts} attempt(s)`);
    }

    script = withSignature(script, profile);
    ruleIssues = checkScript(script, profile);
    if (hasClaude()) {
      log("fact checking…");
      const fc = await factCheck(profile, script);
      fact = { passed: fc.passed && ruleIssues.length === 0, issues: [...ruleIssues, ...fc.issues] };
    } else {
      fact = { passed: false, issues: [...ruleIssues, "model fact check skipped: no WH_ANTHROPIC_API_KEY"] };
    }

    if (opts.scriptOnly) break;
    const provider = createProvider(opts.provider);
    log(`synthesizing with ${provider.name}…`);
    const lines = script.turns.map(({ speaker, text }) => ({ speaker, text }));
    const result = await provider.synthesize(lines, withGlobalPronunciations(profile.pronunciations));
    audio = result.audio;
    voiceModel = result.model;
    duration = await durationSeconds(audio);

    lengthIssue = checkDuration(duration);
    // Only a freshly written script can be rewritten; a reused or manual script would come out the same.
    if (!lengthIssue || !fresh || round === MAX_ROUNDS) break;
    const words = wordCount(script);
    const target = Math.round(words * ((AUDIO_SECONDS.min + AUDIO_SECONDS.max) / 2 / duration));
    log(`${lengthIssue}; rewriting at about ${target} words`);
    lengthFeedback = [
      `The previous draft had ${words} words and its audio ran ${duration}s, but audio must run ${AUDIO_SECONDS.min}-${AUDIO_SECONDS.max}s. Rewrite it at about ${target} words.`,
    ];
  }

  const metadata: Metadata = {
    hotel_slug: slug,
    version: await nextVersion(slug),
    status: opts.scriptOnly ? "generated" : "needs_review",
    generated_at: new Date().toISOString(),
    profile_last_verified: profile.last_verified,
    script_model: scriptModel,
    voice_provider: opts.scriptOnly ? "none" : opts.provider,
    voice_model: voiceModel,
    word_count: wordCount(script),
    duration_seconds: duration,
    fact_check: fact,
    ...(duration !== null ? { length_check: { passed: lengthIssue === null, ...(lengthIssue ? { issue: lengthIssue } : {}) } } : {}),
  };
  const dir = await saveVersion({ profile, script, audio, metadata });
  return { dir, metadata, ruleIssues };
}
