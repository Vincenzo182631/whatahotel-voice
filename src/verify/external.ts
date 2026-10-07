import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { loadProfile } from "../core/profile.js";
import { ScriptSchema, type Claim, type HotelProfile } from "../core/schema.js";
import { FACTCHECK_SYSTEM_PROMPT, SCRIPT_SYSTEM_PROMPT, factcheckUserPrompt, scriptUserPrompt } from "../script/prompt.js";
import { withSignature } from "../script/rules.js";
import type { FirecrawlClient } from "../sources/firecrawl.js";
import { gatherEvidence, type Evidence, type EvidenceTier } from "./evidence.js";
import { CONFIRM_SYSTEM_PROMPT, JUDGE_SYSTEM_PROMPT, checkedFindings, resolveClaim, type ClaimResult } from "./judge.js";
import { finishVerification, splitClaims } from "./index.js";
import { VERIFY_DIR, type VerificationReport } from "./report.js";
import { loadReport, restrictToVerified } from "./restrict.js";

/**
 * Running the model steps in Claude Code instead of through the Anthropic API.
 * The code prepares plain files, a Claude Code subagent reads them and writes a JSON answer,
 * and the code imports that answer. Every safety check stays in code: quotes are matched word
 * for word against the fetched pages, and the policy and script rules run exactly as before.
 */

export const workDir = (slug: string) => path.join(VERIFY_DIR, "work", slug);

export const ExternalFindingsSchema = z.object({
  results: z.array(
    z.object({
      claim_id: z.string(),
      findings: z.array(
        z.object({
          verdict: z.enum(["supported", "partial", "contradicted"]),
          doc_id: z.string(),
          quote: z.string(),
          note: z.string().default(""),
          /** Contradictions only: true after re-reading the claim and the page and agreeing they conflict. */
          confirmed: z.boolean().optional(),
        }),
      ),
    }),
  ),
});
export type ExternalFindings = z.infer<typeof ExternalFindingsSchema>;

export const FactCheckFileSchema = z.object({ passed: z.boolean(), issues: z.array(z.string()) });

/** Turns a subagent's findings into claim results. Quotes are verified here; unconfirmed contradictions are dropped. */
export function resultsFromExternal(claims: Claim[], evidence: Evidence[], external: ExternalFindings): ClaimResult[] {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const returned = new Map(external.results.map((r) => [r.claim_id, r.findings]));
  return claims.map((c) => {
    const raw = (returned.get(c.id) ?? []).filter((f) => f.verdict !== "contradicted" || f.confirmed === true);
    const findings = checkedFindings(raw, byId);
    return { claim_id: c.id, text: c.text, findings, ...resolveClaim(findings) };
  });
}

const JUDGE_OUTPUT = `Write a JSON file with this shape (and nothing else in it):
{"results":[{"claim_id":"f-1","findings":[{"verdict":"supported|partial|contradicted","doc_id":"d3","quote":"copied verbatim from that page","note":"short reason","confirmed":true}]}]}
- Include one entry per claim id in claims.json, in order. A claim nobody addresses gets "findings": [].
- "quote" must be copied exactly from the page text (the file evidence/<doc_id>.txt), at most 240 characters. The code rejects any quote that is not in the page word for word.
- For a "contradicted" finding, re-read the claim and the page once more. Set "confirmed": true only if they really conflict (same thing, incompatible). Rounding or "approximately" wording is not a conflict. Otherwise set "confirmed": false.`;

/** Fetches the pages and writes everything a Claude Code subagent needs to judge one hotel's claims. */
export async function prepareVerification(slug: string, fc: FirecrawlClient, { refresh = false } = {}): Promise<{ dir: string; docs: number; claims: number }> {
  const profile = await loadProfile(slug);
  const { evidence, skipped } = await gatherEvidence(profile, fc, { refresh });
  if (!evidence.length) throw new Error(`No evidence pages could be loaded for ${slug}`);
  const { toJudge } = splitClaims(profile);
  const dir = workDir(slug);
  await mkdir(path.join(dir, "evidence"), { recursive: true });
  for (const e of evidence) await writeFile(path.join(dir, "evidence", `${e.id}.txt`), e.text);
  await writeFile(
    path.join(dir, "evidence", "index.json"),
    JSON.stringify({ docs: evidence.map(({ id, url, tier }) => ({ id, url, tier })), skipped }, null, 2) + "\n",
  );
  await writeFile(path.join(dir, "claims.json"), JSON.stringify(toJudge.map((c) => ({ claim_id: c.id, claim: c.text })), null, 2) + "\n");
  await writeFile(
    path.join(dir, "judge-instructions.md"),
    [
      `# Verify the claims for ${profile.name}`,
      "",
      `Read ${path.join(dir, "claims.json")} and the pages listed in ${path.join(dir, "evidence", "index.json")} (text in evidence/<id>.txt). Judge every claim ONLY against those pages, never from memory.`,
      `Write your answer to ${path.join(dir, "findings.json")}. Do not run other commands or fetch anything else.`,
      "",
      "## How to judge",
      JUDGE_SYSTEM_PROMPT,
      "",
      "## Contradictions",
      CONFIRM_SYSTEM_PROMPT,
      "",
      "## Output",
      JUDGE_OUTPUT,
      "",
    ].join("\n"),
  );
  return { dir, docs: evidence.length, claims: toJudge.length };
}

async function loadEvidence(slug: string): Promise<{ evidence: Evidence[]; skipped: { url: string; reason: string }[] }> {
  const dir = path.join(workDir(slug), "evidence");
  let index: { docs: { id: string; url: string; tier: EvidenceTier }[]; skipped?: { url: string; reason: string }[] };
  try {
    index = JSON.parse(await readFile(path.join(dir, "index.json"), "utf8"));
  } catch {
    throw new Error(`No prepared evidence for ${slug}. Run hotel:verify --prepare first.`);
  }
  const evidence = await Promise.all(index.docs.map(async (d) => ({ ...d, text: await readFile(path.join(dir, `${d.id}.txt`), "utf8") })));
  return { evidence, skipped: index.skipped ?? [] };
}

/** Imports a subagent's findings, re-checks every quote, applies the policy and writes the report. */
export async function importFindings(slug: string, file: string, opts: { apply?: boolean; today?: Date } = {}): Promise<VerificationReport> {
  const profile = await loadProfile(slug);
  const { evidence, skipped } = await loadEvidence(slug);
  const external = ExternalFindingsSchema.parse(JSON.parse(await readFile(file, "utf8")));
  const judged = resultsFromExternal(splitClaims(profile).toJudge, evidence, external);
  return finishVerification(profile, evidence, skipped, judged, opts);
}

async function scriptProfile(slug: string, verifiedOnly: boolean): Promise<HotelProfile> {
  const profile = await loadProfile(slug);
  if (!verifiedOnly) return profile;
  const report = await loadReport(slug);
  if (!report) throw new Error(`No verification report for ${slug}. Run hotel:verify first.`);
  return restrictToVerified(profile, report);
}

/** Writes the script-writing task for a subagent: the same prompts the API path uses. */
export async function prepareWriter(slug: string, { verifiedOnly = false } = {}): Promise<string> {
  const profile = await scriptProfile(slug, verifiedOnly);
  const dir = workDir(slug);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "writer-instructions.md");
  await writeFile(
    file,
    [
      `# Write the script for ${profile.name}`,
      "",
      `Follow the system prompt below using only the hotel data. Write the result as JSON to ${path.join(dir, "script.json")} with this shape and nothing else in the file:`,
      '{"title":"...","turns":[{"speaker":"advisor|traveler","section":"hook|stands_out|best_for|to_know|bottom_line","text":"...","claim_ids":["f-1"]}],"short_version":{"best_for":"...","atmosphere":"...","worth_knowing":"..."}}',
      "Do not write the WhataHotel perks line; the pipeline adds it. Do not run other commands.",
      "",
      "## System prompt",
      SCRIPT_SYSTEM_PROMPT,
      "",
      "## Task",
      scriptUserPrompt(profile),
      "",
    ].join("\n"),
  );
  return file;
}

/** Writes the fact-check task for a subagent: the profile and the script as the listener will hear it. */
export async function prepareFactCheck(slug: string, scriptFile: string, { verifiedOnly = false } = {}): Promise<string> {
  const profile = await scriptProfile(slug, verifiedOnly);
  const script = withSignature(ScriptSchema.parse(JSON.parse(await readFile(scriptFile, "utf8"))), profile);
  const dir = workDir(slug);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "factcheck-instructions.md");
  await writeFile(
    file,
    [
      `# Fact-check the script for ${profile.name}`,
      "",
      `Check the script against the profile only. Write your answer to ${path.join(dir, "factcheck.json")} as {"passed": true|false, "issues": ["turn N: problem", ...]} and nothing else. Do not run other commands.`,
      "",
      "## Instructions",
      FACTCHECK_SYSTEM_PROMPT,
      "",
      "## Profile and script",
      factcheckUserPrompt(profile, JSON.stringify(script, null, 2)),
      "",
    ].join("\n"),
  );
  return file;
}
