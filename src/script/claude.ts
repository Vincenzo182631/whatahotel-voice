import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { ScriptSchema, type HotelProfile, type Script } from "../core/schema.js";
import {
  FACTCHECK_SYSTEM_PROMPT,
  SCRIPT_SYSTEM_PROMPT,
  factcheckUserPrompt,
  scriptUserPrompt,
} from "./prompt.js";
import { checkScript } from "./rules.js";

export const SCRIPT_MODEL = "claude-opus-5-5";

const FactCheckSchema = z.object({
  passed: z.boolean(),
  issues: z.array(z.object({ turn: z.number().int(), problem: z.string() })),
});

export interface ScriptResult {
  script: Script;
  attempts: number;
  /** Deterministic rule problems still present after the last attempt. */
  ruleIssues: string[];
}

/**
 * Structured-output call with refusal fallbacks routed server-side.
 * Thinking is adaptive (always on for this model); effort is set explicitly.
 */
async function parseWith<T extends z.ZodType>(
  client: Anthropic,
  schema: T,
  system: string,
  user: string,
  effort: "low" | "medium" | "high",
): Promise<z.infer<T>> {
  const response = await client.beta.messages.parse({
    model: SCRIPT_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort, format: betaZodOutputFormat(schema) },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") {
    throw new Error(`Model declined: ${response.stop_details?.explanation ?? "no explanation"}`);
  }
  if (response.stop_reason === "max_tokens") throw new Error("Response truncated at max_tokens");
  if (!response.parsed_output) throw new Error("Model returned no parseable output");
  return response.parsed_output as z.infer<T>;
}

/** Writes a script, re-prompting with rule failures up to maxAttempts. */
export async function writeScript(
  profile: HotelProfile,
  { client = new Anthropic(), maxAttempts = 3 }: { client?: Anthropic; maxAttempts?: number } = {},
): Promise<ScriptResult> {
  let feedback: string[] = [];
  let script: Script | undefined;
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    script = await parseWith(client, ScriptSchema, SCRIPT_SYSTEM_PROMPT, scriptUserPrompt(profile, feedback), "high");
    feedback = checkScript(script, profile);
    if (feedback.length === 0) break;
  }
  return { script: script!, attempts: attempt, ruleIssues: feedback };
}

/** Second, independent pass: is every statement supported by the profile? */
export async function factCheck(
  profile: HotelProfile,
  script: Script,
  { client = new Anthropic() }: { client?: Anthropic } = {},
): Promise<{ passed: boolean; issues: string[] }> {
  const result = await parseWith(
    client,
    FactCheckSchema,
    FACTCHECK_SYSTEM_PROMPT,
    factcheckUserPrompt(profile, JSON.stringify(script, null, 2)),
    "high",
  );
  const issues = result.issues.map((i) => `turn ${i.turn}: ${i.problem}`);
  return { passed: result.passed && issues.length === 0, issues };
}
