/**
 * Write and fact-check a script through the Anthropic API, rewriting with the fact checker's
 * issues as feedback until it passes (no audio). Uses only claims hotel:verify proved.
 *   npx tsx scripts/api-write.ts <slug> [maxRounds=4]
 * Writes data/verification/work/<slug>/script.json and factcheck.json, the files
 * `generate --script-file ... --factcheck-file ...` voices. Exits 1 if no round passed.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadProfile } from "../src/core/profile.js";
import { factCheck, writeScript } from "../src/script/claude.js";
import { checkScript, wordCount } from "../src/script/rules.js";
import { loadReport, restrictToVerified } from "../src/verify/restrict.js";

const [slug, roundsArg] = process.argv.slice(2);
if (!slug) {
  console.error("usage: npx tsx scripts/api-write.ts <slug> [maxRounds]");
  process.exit(1);
}
const maxRounds = Number(roundsArg ?? 4);

const report = await loadReport(slug);
if (!report) throw new Error(`No verification report for ${slug}. Run hotel:verify first.`);
const profile = restrictToVerified(await loadProfile(slug), report);
const dir = path.join("data", "verification", "work", slug);
await mkdir(dir, { recursive: true });

let feedback: string[] = [];
for (let round = 1; round <= maxRounds; round++) {
  const { script } = await writeScript(profile, { feedback });
  const ruleIssues = checkScript(script, profile);
  const fc = ruleIssues.length ? { passed: false, issues: [] } : await factCheck(profile, script);
  const issues = [...ruleIssues, ...fc.issues];
  const passed = fc.passed && issues.length === 0;
  await writeFile(path.join(dir, "script.json"), JSON.stringify(script, null, 2) + "\n");
  await writeFile(path.join(dir, "factcheck.json"), JSON.stringify({ passed, issues }, null, 2) + "\n");
  console.log(`${slug} round ${round}: ${wordCount(script)} words, ${passed ? "PASSED" : `${issues.length} issue(s)`}`);
  if (passed) process.exit(0);
  feedback = issues.map((i) => `Fact check: ${i}`);
}
console.log(`${slug}: FAILED after ${maxRounds} rounds`);
process.exit(1);
