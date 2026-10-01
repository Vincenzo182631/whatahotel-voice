import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { HOTELS_DIR, listProfileSlugs, loadProfile, validateProfile } from "./core/profile.js";
import { generateHotel } from "./pipeline.js";
import { importHotel } from "./sources/import.js";
import { withReadOnlyDb, type Query } from "./sources/pi-db.js";
import { WahClient } from "./sources/wah-api.js";
import { fetchWhataHotelPage } from "./sources/whatahotel.js";
import { listVersions, readMetadata, setStatus } from "./storage/local.js";

const HELP = `WhataHotel Voice — hotel conversation pipeline

Usage: npm run hotel -- <command> [options]

  scrape    --hotel <slug> | --collection pilot   Fetch whatahotel.com page(s) into data/sources/
  import    --hotel <slug> | --collection pilot [--from api,db] [--dry-run]
                                                  Add claims from the WhataHotel data API and the
                                                  Price Intelligence DB (read-only) to profiles
  validate  [--hotel <slug>]                      Check profile schema and source references
  script    --hotel <slug>                        Write + check a script only (no audio)
  generate  --hotel <slug> [--provider mock|elevenlabs|gemini]
            [--from-version N] [--script-file path]  Script + audio as a new version
  batch     --collection pilot [--provider ...]   Generate for every hotel in a collection
  list                                            Latest version and status per hotel
  review    --hotel <slug> --version N (--approve | --reject) [--note "..."] [--force]

Nothing is ever overwritten: each run creates output/<slug>/v<N>/.`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    hotel: { type: "string" },
    collection: { type: "string" },
    provider: { type: "string", default: "mock" },
    "from-version": { type: "string" },
    "script-file": { type: "string" },
    version: { type: "string" },
    approve: { type: "boolean" },
    reject: { type: "boolean" },
    note: { type: "string" },
    force: { type: "boolean" },
    from: { type: "string", default: "api,db" },
    "dry-run": { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
});

const log = (msg: string) => console.log(`  ${msg}`);

interface Collection {
  hotels: Array<{ slug: string; url: string; category: string }>;
}

async function loadCollection(name: string): Promise<Collection> {
  return JSON.parse(await readFile(path.resolve("data", `${name}.json`), "utf8"));
}

function need<T>(value: T | undefined, flag: string): T {
  if (value === undefined) throw new Error(`Missing --${flag}`);
  return value;
}

async function main() {
  const [command] = positionals;
  if (!command || values.help) return console.log(HELP);

  switch (command) {
    case "scrape": {
      const collection = await loadCollection(values.collection ?? "pilot");
      const targets = values.hotel ? collection.hotels.filter((h) => h.slug === values.hotel) : collection.hotels;
      if (!targets.length) throw new Error(`No hotel "${values.hotel}" in collection`);
      for (const h of targets) {
        const page = await fetchWhataHotelPage(h.url);
        const file = path.resolve("data/sources", `${h.slug}.whatahotel.json`);
        await writeFile(file, JSON.stringify(page, null, 2) + "\n");
        console.log(`✓ ${h.slug}: ${page.pros.length} highlights, ${page.cons.length} considerations`);
      }
      return;
    }

    case "import": {
      const from = new Set(values.from!.split(",").map((s) => s.trim()));
      for (const f of from) if (f !== "api" && f !== "db") throw new Error(`--from accepts api,db (got "${f}")`);
      const slugs = values.hotel
        ? [values.hotel]
        : (await loadCollection(need(values.collection, "collection or --hotel"))).hotels.map((h) => h.slug);
      const api = from.has("api") ? WahClient.fromEnv() : undefined;
      const run = async (db?: Query) => {
        for (const slug of slugs) {
          console.log(`→ ${slug}${values["dry-run"] ? " (dry run)" : ""}`);
          try {
            const r = await importHotel(slug, { api, db, dryRun: values["dry-run"] });
            console.log(`  ✓ ${r.added.length} added, ${r.updated.length} updated, ${r.skipped.length} duplicates skipped`);
            for (const id of [...r.added, ...r.updated]) {
              const claim = r.profile.facts.find((f) => f.id === id);
              console.log(`    + ${id}: ${claim?.text}`);
            }
            for (const w of r.warnings) console.log(`    ! ${w}`);
          } catch (err) {
            process.exitCode = 1;
            console.log(`  ✗ ${(err as Error).message}`);
          }
        }
      };
      if (from.has("db")) await withReadOnlyDb(run);
      else await run();
      return;
    }

    case "validate": {
      const slugs = values.hotel ? [values.hotel] : await listProfileSlugs();
      let failed = 0;
      for (const slug of slugs) {
        const raw = JSON.parse(await readFile(path.join(HOTELS_DIR, `${slug}.json`), "utf8"));
        const result = validateProfile(raw);
        if (result.ok) {
          const p = result.profile!;
          console.log(
            `✓ ${slug} (${p.status}): ${p.facts.length} facts, ${p.highlights.length} highlights, ` +
              `${p.considerations.length} considerations, ${p.sources.length} sources`,
          );
        } else {
          failed++;
          console.log(`✗ ${slug}\n    ${result.errors.join("\n    ")}`);
        }
      }
      if (failed) process.exitCode = 1;
      return;
    }

    case "script":
    case "generate": {
      const slug = need(values.hotel, "hotel");
      console.log(`→ ${slug}`);
      const result = await generateHotel(slug, {
        provider: values.provider!,
        fromVersion: values["from-version"] ? Number(values["from-version"]) : undefined,
        scriptFile: values["script-file"],
        scriptOnly: command === "script",
        log,
      });
      report(result.dir, result.metadata);
      return;
    }

    case "batch": {
      const collection = await loadCollection(need(values.collection, "collection"));
      for (const h of collection.hotels) {
        console.log(`→ ${h.slug}`);
        try {
          const result = await generateHotel(h.slug, { provider: values.provider!, log });
          report(result.dir, result.metadata);
        } catch (err) {
          process.exitCode = 1;
          console.log(`  ✗ ${(err as Error).message}`);
        }
      }
      return;
    }

    case "list": {
      for (const slug of await listProfileSlugs()) {
        const profile = await loadProfile(slug);
        const versions = await listVersions(slug);
        const latest = versions[versions.length - 1];
        if (latest === undefined) {
          console.log(`${slug.padEnd(26)} profile:${profile.status.padEnd(9)} no versions`);
          continue;
        }
        const m = await readMetadata(slug, latest);
        console.log(
          `${slug.padEnd(26)} profile:${profile.status.padEnd(9)} v${latest} ${m.status.padEnd(13)} ` +
            `${m.voice_provider.padEnd(10)} ${m.duration_seconds ?? "-"}s  fact-check:${m.fact_check.passed ? "pass" : "FAIL"}`,
        );
      }
      return;
    }

    case "review": {
      const slug = need(values.hotel, "hotel");
      const version = Number(need(values.version, "version"));
      if (values.approve === values.reject) throw new Error("Pass exactly one of --approve or --reject");
      if (values.approve) {
        const [meta, profile] = await Promise.all([readMetadata(slug, version), loadProfile(slug)]);
        const blockers = [
          ...(meta.fact_check.passed ? [] : ["fact check did not pass"]),
          ...(profile.status === "verified" ? [] : ["profile is still a draft"]),
          ...(meta.voice_provider === "mock" || meta.voice_provider === "none" ? ["no real audio"] : []),
        ];
        if (blockers.length && !values.force) {
          throw new Error(`Not approving: ${blockers.join("; ")}. Use --force --note "why" to override.`);
        }
        if (blockers.length && !values.note) throw new Error("--force needs a --note explaining the override");
      }
      const updated = await setStatus(slug, version, values.approve ? "approved" : "rejected", values.note);
      console.log(`✓ ${slug} v${version} → ${updated.status}`);
      return;
    }

    default:
      console.log(HELP);
      process.exitCode = 1;
  }
}

function report(dir: string, m: import("./core/schema.js").Metadata) {
  console.log(
    `  ✓ v${m.version} ${m.status} · ${m.word_count} words · ${m.duration_seconds ?? "-"}s · ` +
      `fact check ${m.fact_check.passed ? "passed" : "FAILED"}`,
  );
  for (const issue of m.fact_check.issues) console.log(`    - ${issue}`);
  console.log(`  ${path.relative(process.cwd(), dir)}`);
}

main().catch((err) => {
  console.error(`✗ ${(err as Error).message}`);
  process.exitCode = 1;
});
