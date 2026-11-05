// usage: npx tsx chk-all.mts <slug> : rule + word checks on data/verification/work/<slug>/script.json (verified-only profile)
import { readFile } from "node:fs/promises";
import { loadProfile } from "/home/user/whatahotel-voice/src/core/profile.ts";
import { ScriptSchema } from "/home/user/whatahotel-voice/src/core/schema.ts";
import { checkScript, withSignature, wordCount } from "/home/user/whatahotel-voice/src/script/rules.ts";
import { loadReport, restrictToVerified } from "/home/user/whatahotel-voice/src/verify/restrict.ts";
const slug = process.argv[2];
let profile = await loadProfile(slug);
const report = await loadReport(slug);
if (report) profile = restrictToVerified(profile, report);
const raw = ScriptSchema.parse(JSON.parse(await readFile(`/home/user/whatahotel-voice/data/verification/work/${slug}/script.json`, "utf8")));
const s = withSignature(raw, profile);
const issues = checkScript(s, profile);

for (const w of ["free", "complimentary"]) if (new RegExp(`\\b${w}\\b`, "i").test(raw.turns.map((t: any) => t.text).join(" "))) issues.push(`authored text uses "${w}"`);
console.log(`${slug}: ${wordCount(s)} words incl. closing; ${issues.length ? "✗\n  - " + issues.join("\n  - ") : "✓ rules pass"}`);
process.exit(issues.length ? 1 : 0);
