/**
 * Re-runnable audit: which hotels' published closing no longer matches what WhataHotel confirms, and which
 * hotels have no published clip. Run `npm run hotel -- offers` first so every hotel has data/research/<slug>/offers.json.
 *   npx tsx scripts/closing-audit.ts      -> docs/closing-review.md and exports/closing-review.csv
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { listProfileSlugs, loadProfile } from "../src/core/profile.js";
import { loadOffersSync, type Benefit } from "../src/offers/store.js";

const HOLD: Record<string, string> = {
  "villa-caldera": "Held: private Exclusive Home, not bookable online (see docs/held-hotels.md)",
  "the-sireya-desaru-coast": "Held: same property as Mandarin Oriental, Desaru Coast, which is published (see docs/held-hotels.md)",
};

interface Row {
  slug: string; name: string; id: number; publish: string; version: string;
  level: "none" | "low" | "medium" | "high"; issues: string[]; offerIssues: string[]; oldClosing: string; newClosing: string;
}

function latest(slug: string): { version: number; status: string; script?: { turns: Array<{ text: string; speaker: string }> } } | undefined {
  const dir = path.join("output", slug);
  if (!existsSync(dir)) return undefined;
  const versions = readdirSync(dir).filter((d) => /^v\d+$/.test(d)).map((d) => Number(d.slice(1))).sort((a, b) => a - b);
  const meta = versions.map((v) => ({ v, m: JSON.parse(readFileSync(path.join(dir, `v${v}`, "metadata.json"), "utf8")) as { status: string } }));
  const pub = [...meta].reverse().find((x) => x.m.status === "published");
  const pick = pub ?? meta[meta.length - 1];
  if (!pick) return undefined;
  const script = JSON.parse(readFileSync(path.join(dir, `v${pick.v}`, "script.json"), "utf8"));
  return { version: pick.v, status: pick.m.status, script };
}

const by = (bs: Benefit[], k: string) => bs.find((b) => b.kind === k);

function judge(oldClosing: string, bs: Benefit[]): { level: Row["level"]; issues: string[] } {
  const issues: string[] = [];
  let level: Row["level"] = "none";
  const bump = (l: Row["level"]) => { const o = ["none", "low", "medium", "high"]; if (o.indexOf(l) > o.indexOf(level)) level = l; };
  const credit = by(bs, "credit");
  if (/\bcredit\b|\$\d/i.test(oldClosing)) {
    if (credit?.status === "conflict" || credit?.status === "unclear") { bump("high"); issues.push(`says a $100 credit, but WhataHotel now shows conflicting credit amounts (${credit.note ?? "see offers.json"})`); }
    else if (credit?.status === "absent") { bump("high"); issues.push("says a credit, which the hotel page no longer lists"); }
    else if (credit?.status === "confirmed") {
      const missing = [credit.qualifiers.includes("food_beverage_or_spa") && "credit only covers food and beverage or spa", credit.qualifiers.includes("per_stay") && "credit is per stay", (credit.suiteAmount || credit.suitesHigher) && (credit.suiteAmount ? `suites get $${credit.suiteAmount}` : "suites get a higher credit")].filter(Boolean) as string[];
      if (credit.amount !== 100) { bump("high"); issues.push(`says $100 but WhataHotel says $${credit.amount}`); }
      if (missing.length) { bump("medium"); issues.push(`omits credit conditions: ${missing.join("; ")}`); }
    }
  }
  const up = by(bs, "upgrade");
  if (/upgrade/i.test(oldClosing) && up?.status !== "confirmed") { bump("high"); issues.push(`mentions a priority upgrade, but it is ${up?.status ?? "not listed"} now`); }
  for (const [kind, re, label] of [["breakfast", /breakfast/i, "breakfast"], ["wifi", /wi-?fi/i, "Wi-Fi"]] as const) {
    if (re.test(oldClosing) && by(bs, kind)?.status !== "confirmed") { bump("high"); issues.push(`mentions ${label}, which is no longer confirmed`); }
  }
  // every published closing ends "among other perks": vague, not wrong, so it is noted here but does not change the level
  if (/other perks/i.test(oldClosing)) issues.push('says "other perks", which WhataHotel does not list (wording; goes with any re-voice)');
  return { level, issues };
}

const rows: Row[] = [];
const profiles = new Set(await listProfileSlugs());
// hotels in a collection file that never got a profile (held or not started)
for (const f of readdirSync("data").filter((n) => /^[a-z0-9-]+\.json$/.test(n))) {
  let c: { hotels?: Array<{ slug?: string; url?: string }> };
  try { c = JSON.parse(readFileSync(path.join("data", f), "utf8")); } catch { continue; }
  for (const h of c.hotels ?? []) {
    if (!h.slug || !h.url || profiles.has(h.slug) || rows.some((r) => r.slug === h.slug)) continue;
    const id = Number(/\/hotels\/(\d+)\//.exec(h.url)?.[1] ?? 0);
    rows.push({ slug: h.slug, name: h.slug.replace(/-/g, " "), id, publish: HOLD[h.slug] ? "not generated (held)" : "not generated (no profile yet)", version: "", level: "none", issues: [HOLD[h.slug] ?? "no profile written; why it was skipped is not recorded, check before starting"], offerIssues: [], oldClosing: "", newClosing: "" });
  }
}
for (const slug of profiles) {
  const p = await loadProfile(slug);
  const offers = loadOffersSync(slug);
  const l = latest(slug);
  const oldClosing = l?.script?.turns.at(-1)?.text ?? "";
  const published = l?.status === "published";
  const j = published && offers ? judge(oldClosing, offers.benefits) : { level: "none" as const, issues: [] as string[] };
  const publish = published ? "published" : l ? `not published (${l.status})` : HOLD[slug] ? "not generated (held)" : "not generated";
  rows.push({ slug, name: p.name, id: p.whatahotel_id, publish, version: l ? `v${l.version}` : "", level: j.level, issues: !published ? [HOLD[slug] ?? (l ? `latest v${l.version} is ${l.status}` : "no clip yet")] : j.issues, offerIssues: offers?.issues ?? ["no offers.json: run hotel:offers"], oldClosing, newClosing: offers?.closing?.text ?? "" });
}

const pub = rows.filter((r) => r.publish === "published");
const unpub = rows.filter((r) => r.publish !== "published");
const lvl = (l: string) => pub.filter((r) => r.level === l);
const cell = (s: string) => s.replace(/\|/g, "/").replace(/\n/g, " ");
const table = (rs: Row[]) => ["| Hotel | ID | Version | What is off |", "|---|---|---|---|", ...rs.map((r) => `| ${cell(r.name)} (${r.slug}) | ${r.id} | ${r.version} | ${cell(r.issues.join("; "))} |`)].join("\n");

const md = `# Closing review

Generated by \`scripts/closing-audit.ts\` on ${new Date().toISOString().slice(0, 10)}. Re-run it after \`npm run hotel -- offers\`. Full detail: \`exports/closing-review.csv\`; per-hotel evidence: \`data/research/<slug>/offers.json\`.

A published clip's closing is compared with what WhataHotel confirms today for that property (hotel page + chain page). Nothing here has been re-voiced or changed.

## Summary
- Published clips checked: ${pub.length}. States something not confirmed now: ${lvl("high").length}. Leaves out a material credit condition: ${lvl("medium").length}. Otherwise still accurate: ${lvl("none").length}.
- Every published closing ends "among other perks". That is vague rather than wrong, so it does not change the level, but any re-voice drops it.
- Not published: ${unpub.length}.

## High: re-voice or decide first (${lvl("high").length})
${lvl("high").length ? table(lvl("high")) : "None."}

## Medium: closing leaves out a credit condition (${lvl("medium").length})
${lvl("medium").length ? table(lvl("medium")) : "None."}

## Not published (${unpub.length})
${unpub.length ? table(unpub) : "None."}

## How to work through it
1. Decide the credit question for the high rows (which amount applies), then rerun \`hotel:offers --hotel <slug>\`.
2. Re-voice: \`hotel:generate\` with the new closing (the script is reused with \`--from-version N\`; the closing line is replaced automatically), review, approve, publish.
3. Hotels whose offers need review also list the reason under \`issues\` in their \`offers.json\`.
`;
await mkdir("docs", { recursive: true });
await mkdir("exports", { recursive: true });
await writeFile("docs/closing-review.md", md);
const csv = [["Hotel ID", "Hotel", "Slug", "Publish status", "Version", "Level", "What is off", "Offers review notes", "Published closing", "New closing"], ...rows.map((r) => [String(r.id), r.name, r.slug, r.publish, r.version, r.level, r.issues.join("; "), r.offerIssues.map((i) => i.slice(0, 160)).join(" | "), r.oldClosing, r.newClosing])]
  .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n") + "\n";
await writeFile("exports/closing-review.csv", csv);
console.log(`published ${pub.length}: ok ${lvl("none").length}, low ${lvl("low").length}, medium ${lvl("medium").length}, high ${lvl("high").length}; not published ${unpub.length}`);
