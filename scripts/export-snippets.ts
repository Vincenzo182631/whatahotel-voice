/**
 * Admin CSV (Hotel ID, Hotel name, Snippet) for the published hotels of one or more collections.
 *   npx tsx scripts/export-snippets.ts <out-name> <collection> [<collection> ...]
 *   e.g. npx tsx scripts/export-snippets.ts ritz-carlton ritz-carlton-batch-1 ritz-carlton-batch-2
 * Writes exports/<out-name>-admin.csv. Hotels without a published clip are listed on stderr and left out.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadProfile } from "../src/core/profile.js";

const BLOB = "https://mgybenoop5mbek0c.public.blob.vercel-storage.com";
const [outName, ...collections] = process.argv.slice(2);
if (!outName || !collections.length) {
  console.error("usage: npx tsx scripts/export-snippets.ts <out-name> <collection> [...]");
  process.exit(1);
}

const published = (slug: string) => {
  const dir = path.join("output", slug);
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((v) => /^v\d+$/.test(v) && JSON.parse(readFileSync(path.join(dir, v, "metadata.json"), "utf8")).status === "published");
};

const rows: string[][] = [["Hotel ID", "Hotel name", "Snippet"]];
for (const c of collections) {
  const col = JSON.parse(readFileSync(path.join("data", `${c}.json`), "utf8")) as { hotels: Array<{ slug: string }> };
  for (const { slug } of col.hotels) {
    if (!published(slug)) { console.error(`not published, skipped: ${slug}`); continue; }
    const p = await loadProfile(slug);
    rows.push([String(p.whatahotel_id), p.name, `<script src="${BLOB}/wah-take.js" data-transcript="${BLOB}/takes/${slug}/current/transcript.json"></script>`]);
  }
}
await mkdir("exports", { recursive: true });
await writeFile(`exports/${outName}-admin.csv`, rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n") + "\n");
console.log(`exports/${outName}-admin.csv: ${rows.length - 1} hotels`);
