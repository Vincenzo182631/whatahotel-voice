import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { HOTELS_DIR, listProfileSlugs, loadProfile, validateProfile } from "./core/profile.js";
import { generateHotel } from "./pipeline.js";
import { FirecrawlClient } from "./sources/firecrawl.js";
import { checkFreshness, isExpired, needsRefresh, WARN_DAYS } from "./core/freshness.js";
import { promoteToCurrent, publishTake } from "./publish/blob.js";
import { importHotel } from "./sources/import.js";
import { verifyHotel } from "./verify/index.js";
import { buildOffers } from "./offers/index.js";
import { Budget, limitsFromEnv } from "./research/budget.js";
import { assertResearchReady, importResearch, runResearch } from "./research/research.js";
import { importFindings, prepareFactCheck, prepareVerification, prepareWriter } from "./verify/external.js";
import { withReadOnlyDb, type Query } from "./sources/pi-db.js";
import { WahClient } from "./sources/wah-api.js";
import { fetchWhataHotelPage, parseWhataHotelPage } from "./sources/whatahotel.js";
import { listVersions, readMetadata, readScript, setStatus } from "./storage/local.js";

const HELP = `WhataHotel Voice — hotel conversation pipeline

Usage: npm run hotel -- <command> [options]

  scrape    --hotel <slug> | --collection pilot   Fetch whatahotel.com page(s) into data/sources/
  scrape    ... --via firecrawl                   Use Firecrawl instead of a plain fetch (needs FIRECRAWL_API_KEY)
  research  --url <url> [--out file]              Firecrawl a page to markdown (default data/research/<host>.md)
  research  --hotel <slug> [--chain <id>|independent] [--official-url <url>] [--with-editorial] [--refresh]
            [--max-pages N] [--max-fc-calls N] [--max-retries N] [--max-chars N]
                                                  Confirm the hotel's official site (never guessed), fetch its
                                                  property pages inside per-hotel limits, and write the extraction
                                                  task. Limits default from WH_RESEARCH_MAX_PAGES/_FC_CALLS/_RETRIES/_CHARS
  research  --hotel <slug> --import <facts.json>  Re-check every excerpt in code, hold out disputed/promotional/undated
                                                  claims, and write data/research/<slug>/research.json. A hotel marked
                                                  Needs review is refused by script/generate
  offers    --hotel <slug> | --collection <name> [--chain-url <url>]   (no flag: every profile)
                                                  Read the hotel's and its chain's WhataHotel pages, confirm which
                                                  benefits apply to that property (conflicts and unclear terms are
                                                  left out and flagged) and write data/research/<slug>/offers.json
                                                  with the closing line the script will end on
  import    --hotel <slug> | --collection pilot [--from api,db] [--dry-run]
                                                  Add claims from the WhataHotel data API and the
                                                  Price Intelligence DB (read-only) to profiles
  validate  [--hotel <slug>]                      Check profile schema and source references
  script    --hotel <slug>                        Write + check a script only (no audio)
  generate  --hotel <slug> [--provider mock|elevenlabs|gemini]
            [--from-version N] [--script-file path]  Script + audio as a new version
            [--verified-only]                       Use only claims hotel:verify proved (also on script, batch)
  batch     --collection pilot [--provider ...]   Generate for every hotel in a collection
  publish   --hotel <slug> --version N --script-url <url> [--no-current | --current-only]
                                                  Upload an approved version to Vercel Blob (needs
                                                  BLOB_READ_WRITE_TOKEN), mark it published and point
                                                  takes/<slug>/current/ at it. --current-only just
                                                  repoints current at an already uploaded version
  freshness [--hotel <slug>] [--within N]         Claims expiring within N days (default ${WARN_DAYS}) or already
                                                  expired, and profiles not verified for 90+ days.
                                                  Exits 1 when a clip relies on an expired claim
  verify    --hotel <slug> | --collection <name> [--apply] [--refresh]
                                                  Check every claim against the hotel's own Four Seasons
                                                  pages and its Condé Nast Traveler review (needs
                                                  FIRECRAWL_API_KEY and WH_ANTHROPIC_API_KEY). Writes
                                                  data/verification/<slug>.md. --apply marks the profile
                                                  verified when nothing is contradicted and every claim a
                                                  script uses is supported
  verify    --hotel <slug> --prepare              Claude Code path: fetch the pages and write the judge task
  verify    --hotel <slug> --import <findings.json> [--apply]
                                                  Import a subagent's findings (quotes are re-checked in code)
  script    --hotel <slug> --prepare [--verified-only]   Write the script-writing task for a subagent
  check     --hotel <slug> --script-file <path> [--verified-only]
                                                  Write the fact-check task for a subagent
            ... --factcheck-file <path>           (script/generate) use the subagent's {passed, issues}
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
    via: { type: "string" },
    url: { type: "string" },
    out: { type: "string" },
    "script-url": { type: "string" },
    "current-only": { type: "boolean" },
    "no-current": { type: "boolean" },
    within: { type: "string" },
    apply: { type: "boolean" },
    "verified-only": { type: "boolean" },
    prepare: { type: "boolean" },
    import: { type: "string" },
    "factcheck-file": { type: "string" },
    refresh: { type: "boolean" },
    chain: { type: "string" },
    "chain-url": { type: "string" },
    "official-url": { type: "string" },
    "with-editorial": { type: "boolean" },
    "max-pages": { type: "string" },
    "max-fc-calls": { type: "string" },
    "max-retries": { type: "string" },
    "max-chars": { type: "string" },
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
      const fc = values.via === "firecrawl" ? FirecrawlClient.fromEnv() : undefined;
      if (values.via && !fc) throw new Error(`--via accepts firecrawl (got "${values.via}")`);
      for (const h of targets) {
        const page = fc
          ? parseWhataHotelPage((await fc.scrape(h.url, ["rawHtml"])).rawHtml ?? "", h.url)
          : await fetchWhataHotelPage(h.url);
        const file = path.resolve("data/sources", `${h.slug}.whatahotel.json`);
        await writeFile(file, JSON.stringify(page, null, 2) + "\n");
        console.log(`✓ ${h.slug}: ${page.pros.length} highlights, ${page.cons.length} considerations`);
      }
      return;
    }

    case "research": {
      if (values.hotel) {
        const slug = values.hotel;
        if (values.import) {
          const r = await importResearch(slug, values.import);
          console.log(`${r.status === "ready" ? "✓" : "✗"} ${slug}: ${r.verified_facts.length} verified facts, ${r.highlights.length} highlights, ${r.rejected.length} rejected, ${r.unresolved.length} unresolved, ${r.subjective.length} subjective, ${r.contradictions.length} contradictions`);
          for (const reason of r.reasons) console.log(`    - ${reason}`);
          console.log(`  data/research/${slug}/research.json`);
          return;
        }
        const num = (v?: string) => (v ? Number(v) : undefined);
        const budget = new Budget(limitsFromEnv(process.env, { maxPages: num(values["max-pages"]), maxFirecrawlCalls: num(values["max-fc-calls"]), maxRetries: num(values["max-retries"]), maxChars: num(values["max-chars"]) }));
        const r = await runResearch(slug, { fc: FirecrawlClient.fromEnv(), budget, refresh: values.refresh, chain: values.chain, officialUrl: values["official-url"], withEditorial: values["with-editorial"] });
        const id = r.identity;
        console.log(`${id.status === "confirmed" ? "✓" : "✗"} ${slug}: official site ${id.status}${id.official_url ? ` ${id.official_url}` : ""}`);
        for (const e of id.evidence) console.log(`    + ${e}`);
        for (const reason of r.reasons) console.log(`    - ${reason}`);
        const u = r.usage;
        console.log(`  ${r.pages.length} pages · Firecrawl ${u.firecrawl_calls}/${r.limits.maxFirecrawlCalls} calls (${u.firecrawl_searches} searches) · ${u.cache_hits} cached · ${u.direct_fetches} direct · ~${u.est_claude_tokens} tokens of page text`);
        if (r.partial) console.log("  ⚠ partial coverage: a limit was reached, so this hotel is flagged for review (progress saved)");
        if (r.status === "awaiting_extraction") console.log(`  Have a Claude Code subagent follow data/research/${slug}/extract-instructions.md, then run:\n  hotel:research --hotel ${slug} --import data/research/${slug}/facts.json`);
        else console.log(`  Needs review: see data/research/${slug}/research.json`);
        if (r.status === "needs_review") process.exitCode = 1;
        return;
      }
      const url = need(values.url, "url");
      const page = await FirecrawlClient.fromEnv().scrape(url);
      const file = path.resolve(values.out ?? path.join("data/research", `${new URL(url).hostname}.md`));
      await writeFile(file, `<!-- ${url} -->\n\n${page.markdown ?? ""}\n`);
      console.log(`✓ ${url} -> ${path.relative(process.cwd(), file)}`);
      return;
    }

    case "offers": {
      const slugs = values.hotel ? [values.hotel] : values.collection ? (await loadCollection(values.collection)).hotels.map((h) => h.slug) : await listProfileSlugs();
      for (const slug of slugs) {
        try {
          const o = await buildOffers(slug, { chainUrl: values["chain-url"] });
          console.log(`${o.status === "ready" ? "✓" : "✗"} ${slug}: ${o.benefits.filter((b) => b.status === "confirmed").map((b) => b.kind).join(", ") || "no confirmed benefits"}`);
          for (const b of o.benefits.filter((x) => x.status !== "confirmed" && x.status !== "absent")) console.log(`    - ${b.kind}: ${b.status}`);
          for (const i of o.issues) console.log(`    ! ${i.slice(0, 200)}`);
          console.log(`  closing (${o.closing!.words} words, ${o.closing!.template}): ${o.closing!.text}\n  data/research/${slug}/offers.json`);
          if (o.status === "needs_review") process.exitCode = 1;
        } catch (err) {
          process.exitCode = 1;
          console.log(`✗ ${slug}: ${(err as Error).message}`);
        }
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
            console.log(`  ✓ ${r.added.length} added, ${r.updated.length} updated`);
            for (const s of r.skipped) console.log(`    - skipped ${s}`);
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

    case "check": {
      const slug = need(values.hotel, "hotel");
      const file = await prepareFactCheck(slug, need(values["script-file"], "script-file"), { verifiedOnly: values["verified-only"] });
      console.log(`✓ ${file}\n  Have a Claude Code subagent follow it, then pass its factcheck.json to script/generate with --factcheck-file`);
      return;
    }

    case "script":
    case "generate": {
      const slug = need(values.hotel, "hotel");
      await assertResearchReady(slug);
      if (command === "script" && values.prepare) {
        const file = await prepareWriter(slug, { verifiedOnly: values["verified-only"] });
        console.log(`✓ ${file}\n  Have a Claude Code subagent follow it, then run hotel:check on the script it wrote`);
        return;
      }
      console.log(`→ ${slug}`);
      const result = await generateHotel(slug, {
        provider: values.provider!,
        fromVersion: values["from-version"] ? Number(values["from-version"]) : undefined,
        scriptFile: values["script-file"],
        scriptOnly: command === "script",
        verifiedOnly: values["verified-only"],
        factcheckFile: values["factcheck-file"],
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
          const result = await generateHotel(h.slug, { provider: values.provider!, verifiedOnly: values["verified-only"], log });
          report(result.dir, result.metadata);
        } catch (err) {
          process.exitCode = 1;
          console.log(`  ✗ ${(err as Error).message}`);
        }
      }
      return;
    }

    case "verify": {
      const slugs = values.hotel
        ? [values.hotel]
        : values.collection
          ? (await loadCollection(values.collection)).hotels.map((h) => h.slug)
          : await listProfileSlugs();
      if (values.prepare || values.import) {
        const slug = need(values.hotel, "hotel");
        if (values.prepare) {
          const r = await prepareVerification(slug, FirecrawlClient.fromEnv(), { refresh: values.refresh });
          console.log(`✓ ${slug}: ${r.docs} pages, ${r.claims} claims\n  Have a Claude Code subagent follow ${r.dir}/judge-instructions.md, then run:\n  hotel:verify --hotel ${slug} --import ${r.dir}/findings.json [--apply]`);
        } else {
          const r = await importFindings(slug, values.import!, { apply: values.apply });
          const c = r.decision.counts;
          console.log(`${r.decision.eligible ? "✓" : "✗"} ${slug}: ${c.supported} supported, ${c.contradicted} contradicted, ${c.unverified} unverified, ${c.exempt} WhataHotel's own${r.applied ? " · profile marked verified" : ""}`);
          for (const b of r.decision.blockers) console.log(`    - ${b}`);
          console.log(`  data/verification/${slug}.md`);
        }
        return;
      }
      const fc = FirecrawlClient.fromEnv();
      for (const slug of slugs) {
        console.log(`→ ${slug}`);
        try {
          const r = await verifyHotel(slug, { fc, apply: values.apply, refresh: values.refresh });
          const c = r.decision.counts;
          console.log(
            `  ${r.decision.eligible ? "✓" : "✗"} ${c.supported} supported, ${c.contradicted} contradicted, ${c.unverified} unverified, ${c.exempt} WhataHotel's own · ` +
              `${r.evidence.length} pages${r.applied ? " · profile marked verified" : ""}`,
          );
          for (const b of r.decision.blockers) console.log(`    - ${b}`);
          console.log(`  data/verification/${slug}.md`);
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
        const [meta, profile, script] = await Promise.all([readMetadata(slug, version), loadProfile(slug), readScript(slug, version).catch(() => undefined)]);
        const cited = new Set(script?.turns.flatMap((t) => t.claim_ids) ?? []);
        const expiredUsed = [...profile.facts, ...profile.highlights, ...profile.considerations].filter((c) => cited.has(c.id) && isExpired(c));
        const blockers = [
          ...(expiredUsed.length ? [`uses expired claims (${expiredUsed.map((c) => `${c.id} expired ${c.expires}`).join(", ")})`] : []),
          ...(meta.fact_check.passed ? [] : ["fact check did not pass"]),
          ...(meta.length_check && !meta.length_check.passed ? [meta.length_check.issue ?? "audio length out of range"] : []),
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

    case "freshness": {
      const slugs = values.hotel ? [values.hotel] : await listProfileSlugs();
      const within = values.within ? Number(values.within) : WARN_DAYS;
      if (!Number.isInteger(within) || within < 0) throw new Error("--within needs a whole number of days");
      let failing = false;
      for (const slug of slugs) {
        const profile = await loadProfile(slug);
        const [latest] = (await listVersions(slug)).slice(-1);
        const script = latest ? await readScript(slug, latest).catch(() => undefined) : undefined;
        const f = checkFreshness(profile, { warnDays: within, script });
        const note = (c: (typeof f.expired)[number]) =>
          `    ${c.days_left < 0 ? `EXPIRED ${-c.days_left}d ago` : `expires in ${c.days_left}d`} (${c.expires}) ${c.id}${c.in_clip ? "" : " [not in latest clip]"}: ${c.text.slice(0, 90)}`;
        const state = needsRefresh(f) ? "REFRESH" : f.expired.length || f.expiring.length ? "watch" : "ok";
        console.log(`${state.padEnd(7)} ${slug}  (profile verified ${f.profile_age_days}d ago${f.profile_stale ? ", STALE" : ""}${latest ? `, clip v${latest}` : ", no clip"})`);
        for (const c of [...f.expired, ...f.expiring]) console.log(note(c));
        if (f.expired.some((c) => c.in_clip) && latest) failing = true;
      }
      if (failing) process.exitCode = 1;
      return;
    }

    case "publish": {
      const slug = need(values.hotel, "hotel");
      const version = Number(need(values.version, "version"));
      const scriptUrl = need(values["script-url"], "script-url");
      if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
      if (values["current-only"] && values["no-current"]) throw new Error("--current-only and --no-current conflict");
      const m = values["current-only"]
        ? await promoteToCurrent(slug, version, { scriptUrl })
        : await publishTake(slug, version, { scriptUrl, setCurrent: !values["no-current"] });
      console.log(`✓ ${slug} v${version} → ${values["current-only"] ? "current" : "published"}\n  audio: ${m.audio_url}\n  transcript: ${m.transcript_url}`);
      if (m.current_transcript_url) console.log(`  current transcript: ${m.current_transcript_url}`);
      console.log(`  embed: ${m.embed}`);
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
  if (m.length_check && !m.length_check.passed) console.log(`    ! ${m.length_check.issue}`);
  for (const issue of m.fact_check.issues) console.log(`    - ${issue}`);
  console.log(`  ${path.relative(process.cwd(), dir)}`);
}

main().catch((err) => {
  console.error(`✗ ${(err as Error).message}`);
  process.exitCode = 1;
});
