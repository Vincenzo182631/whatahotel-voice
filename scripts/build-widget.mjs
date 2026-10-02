// Bundles the embed to dist/wah-take.js and builds a local demo from approved outputs.
import { build } from "esbuild";
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

await build({ entryPoints: ["src/widget/embed.ts"], bundle: true, minify: true, format: "iife", target: "es2019", outfile: "dist/wah-take.js" });

// Demo: one page per run with every approved hotel, files copied beside it.
const demo = "dist/demo";
const items = [];
for (const slug of await readdir("output").catch(() => [])) {
  const metaFile = path.join("output", slug, "v1", "metadata.json");
  const meta = JSON.parse(await readFile(metaFile, "utf8").catch(() => "null") ?? "null");
  if (!meta || !["approved", "published"].includes(meta.status)) continue;
  await mkdir(path.join(demo, slug), { recursive: true });
  for (const f of ["audio.mp3", "transcript.json"]) await cp(path.join("output", slug, "v1", f), path.join(demo, slug, f));
  items.push(slug);
}
await cp("dist/wah-take.js", path.join(demo, "wah-take.js"));
await writeFile(
  path.join(demo, "index.html"),
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The WhataHotel Take: demo</title>
<body style="font-family:system-ui;max-width:680px;margin:24px auto;padding:0 16px;display:grid;gap:20px">
${items.map((s) => `<script src="wah-take.js" data-transcript="${s}/transcript.json"></script>`).join("\n")}
</body>\n`,
);
console.log(`built dist/wah-take.js; demo with ${items.length} hotel(s) in ${demo}/`);
