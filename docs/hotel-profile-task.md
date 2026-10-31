# Task: research one hotel and write its profile (any chain or independent hotel)

You are given a hotel slug. Its WhataHotel page is already scraped at `data/sources/<slug>.whatahotel.json`. Work only on that hotel and write only the files named below. Do not touch git or other hotels' files.

Prefix every `npx tsx src/cli.ts` command with `env -u WH_ANTHROPIC_API_KEY NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1 WH_FIRECRAWL_GAP_MS=4000`. Never print or write any API key.

## 1. Confirm the hotel and its official site
`... npx tsx src/cli.ts research --hotel <slug> --with-editorial --max-pages 12 --max-fc-calls 16`

- The command never guesses: it searches, drops third-party sites, requires the hotel's name and city on the page and writes `data/research/<slug>/`.
- If it prints "needs_review" (site not confirmed, two similar properties, closed, renamed, a residence rather than a hotel), STOP and report its reasons. Do not write a profile.
- The hotel's WhataHotel name can differ from the official one (renames, "The ..." prefixes). That is fine when the page ties them together; say so in your report.
- Only that property's pages count. Never use another hotel's or another chain's pages.

## 2. Extract verified facts
Follow `data/research/<slug>/extract-instructions.md` and write `data/research/<slug>/facts.json`, then run
`... npx tsx src/cli.ts research --hotel <slug> --import data/research/<slug>/facts.json`.
The code re-checks every excerpt word for word. If it reports fewer than 5 verified facts or "needs_review", STOP and report why.
Read the resulting `data/research/<slug>/research.json`: `verified_facts` (each with its source URL and excerpt) and `highlights` are the only material you may use.

## 3. Write `data/hotels/<slug>.json` (HotelProfileSchema, see src/core/schema.ts and README "Data")
Use `data/hotels/four-seasons-cairo-first-residence.json` as the structural template only (ids f-1.., h-1.., c-1.., sources s1..). `status` MUST be "draft"; `last_verified` and every `accessed` = 2026-10-09.
- `slug`, `whatahotel_id`, `whatahotel_url`, `name`, `location` come from the scraped WhataHotel page (`name` as WhataHotel names it; the official name may go in `positioning`). `category` from the batch file in `data/` that lists the slug.
- facts: 8-12 claims, highlights: 3-5, considerations: 2-3. Every claim comes from a verified fact: keep its meaning exactly, one atomic statement, no new facts, no numbers the fact does not give. Highlights come from `research.json` `highlights` (most distinctive first).
- sources: s1 = the WhataHotel page (type "whatahotel"); then one source per distinct official page you cite (type "official", its URL) and the Condé Nast Traveler page if cited (type "press"). Each claim cites the source its excerpt came from.
- considerations: real, sourced practicalities from the verified facts (location, seasonal closures, renovation, small spa/pool). A WhataHotel con is allowed if phrased "WhataHotel notes ..." with no numbers. Do not claim a single venue is temporarily closed.
- Time-bound claims (renovations, openings, awards) need `expires` (YYYY-MM-DD). A claim with `needs_date_check` and no clear date is left out.
- Leave `perks` as `[]`. The closing is built later from WhataHotel's verified offers.
- Do NOT write claims about room or suite counts, pool lengths, or opening hours; sources disagree on them constantly.
- Do NOT copy superlatives or self-praise ("best", "only", "iconic", "world-class") unless an official or Condé Nast Traveler page states it as a fact and `research.json` lists it as a verified fact.
- `positioning` and `best_for` are shown to the script writer: plain wording that only your cited claims establish.
- `pronunciations`: hard proper nouns in your claims; `say_as` lowercase syllables joined by hyphens.

## 4. Check the offers
`... npx tsx src/cli.ts offers --hotel <slug>` and note any `!` issues in your report (they are reviewed later; do not edit `offers.json`).

## 5. Validate
`npm run -s hotel:validate` and `npx vitest run test/profile.test.ts`; fix any error for your slug.

## Report (brief)
Official URL and whether the hotel is open; counts (facts / highlights / considerations); anything rejected, contradicted or inaccessible; offers issues; anything the reviewer should look at.
