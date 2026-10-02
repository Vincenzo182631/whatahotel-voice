---
name: official-site-check
description: Check a hotel's OFFICIAL website (not whatahotel.com or third-party sites) with Firecrawl to verify or add facts to a hotel profile. Use when a claim needs official-site support, when peninsula.com / fourseasons.com return 403 to plain fetches, or when asked to scrape or check an official hotel site.
---

# Official site check

Snapshots a hotel's own website as markdown so a person can verify profile claims against it.

## Run

```bash
npm run hotel:official -- --hotel <slug>        # one hotel
npm run hotel:official -- --collection pilot    # all pilot hotels
```

Needs `FIRECRAWL_API_KEY` (see `.env.example`). Without it the command stops with a clear error; do not fall back to guessing.

- Pages to read come from `data/official-sites.json` (`slug` -> `site` + `pages`). Add specific pages there (rooms, dining, spa, kids) for more than the home page. Official URLs only, https.
- Output: `data/sources/<slug>.official.json` with `pages[]` (url, title, statusCode, markdown, fetchedAt) and `errors[]`.

## Rules

1. **Read `errors[]` first.** A page that failed or answered HTTP 4xx was NOT read. Never treat it as confirming or contradicting anything.
2. **Snapshots are evidence, not claims.** Do not auto-add facts to `data/hotels/<slug>.json`. Quote the snapshot, then add or fix a claim with the page URL as its source, as in `data/research/OFFICIAL-SITE-CHECK.md`.
3. **Check identity.** Confirm the page's hotel name/address matches the WhataHotel API record (`npm run hotel:import`) before using it.
4. **Official beats third-party; conflicts are flagged.** If the official site disagrees with whatahotel.com or the API, report both. Do not pick silently.
5. **Dated.** Use `fetchedAt`; room counts, hours and programmes change.
6. Never print or commit the API key. It travels in a header, not the URL.
