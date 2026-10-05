# WhataHotel Voice

**The WhataHotel Take**: a ~75-second conversation between two WhataHotel hosts about a hotel, built to help a traveler decide whether to book. It is pre-generated and reviewed before it reaches whatahotel.com, never generated live.

- **Luxury Advisor**: what stands out.
- **Candid Traveler**: things to consider.

The script is grounded only in a sourced hotel profile: every claim cites a source, and every script turn cites claims.

## Pipeline

```
whatahotel.com page ─┐
official site/press ─┼─► hotel profile (data/hotels/<slug>.json)
WhataHotel API/CMS ──┘     facts · highlights · considerations · sources
                                  │
                                  ▼
          Claude script writer (structured output, claim ids per turn)
                                  │
                rule checks (length, structure, banned framing, citations)
                                  │
                  Claude fact check (independent pass vs. profile)
                                  │
              voice provider: ElevenLabs | Gemini | mock (offline)
                                  │
        output/<slug>/v<N>/  audio.mp3 · transcript.json · script.json
                             source-profile.json · metadata.json
                                  │
            review: needs_review → approved → published (Phase 4)
```

## Setup

```bash
npm install
cp .env.example .env   # add keys when you have them
```

Requires Node 20+ and `ffmpeg`/`ffprobe` on PATH.

Keys (none are needed for the offline mock run):

| Key | Used for |
|---|---|
| `WH_ANTHROPIC_API_KEY` | Writing scripts and fact checking (`claude-opus-5-5`). Not `ANTHROPIC_API_KEY`: Claude Code cloud environments reserve that name for their own login (it is still accepted as a fallback locally) |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ADVISOR`, `ELEVENLABS_VOICE_TRAVELER` | Text-to-Dialogue voices (model set by `ELEVENLABS_MODEL`, default `eleven_v4`). In the cloud environment the key is an **API credential** (host `api.elevenlabs.io`, header `xi-api-key`, no prefix) instead of a variable; the code then sends no key itself |
| `ELEVENLABS_MODEL` | Optional model override for Text-to-Dialogue (default `eleven_v4`; `eleven_v3` also works). Recorded as `voice_model` in `metadata.json` |
| `ELEVENLABS_PRONUNCIATION_DICT_ID` | Optional pronunciation dictionary; otherwise profile respellings are used |
| `GEMINI_API_KEY` (+ optional `GEMINI_VOICE_*`, `GEMINI_TTS_MODEL`) | Optional fallback only: Gemini multi-speaker TTS. Not used, since ElevenLabs is the chosen provider |
| `FIRECRAWL_API_KEY` | Optional. `scrape --via firecrawl` and `research --url` (page → markdown) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob store token, used only by `publish` |
| `WAH_API_KEY` | WhataHotel data API (`hotel`, `info`): the same key Price Intelligence uses |
| `PI_DATABASE_URL` | Price Intelligence Neon database. **Use a read-only role**; queries also run in a READ ONLY transaction |

## Commands

```bash
npm run hotel:scrape -- --collection pilot          # refresh data/sources/ from whatahotel.com
npm run hotel:scrape -- --collection pilot --via firecrawl   # same, through Firecrawl
npm run hotel:research -- --url https://example.com/hotel     # official site → data/research/<host>.md
npm run hotel:import -- --collection pilot --dry-run  # preview claims from the WhataHotel API + Price Intelligence DB
npm run hotel:import -- --hotel peninsula-tokyo --from db   # one hotel, one source
npm run hotel:validate                              # schema + source-reference checks
npm run hotel:script -- --hotel il-san-pietro-positano          # script only
npm run hotel:generate -- --hotel il-san-pietro-positano --provider elevenlabs
npm run hotel:generate -- --hotel il-san-pietro-positano --provider gemini --from-version 1   # same script, other voices
npm run hotel:generate -- --hotel test --provider mock --script-file my-script.json            # offline
npm run hotel:batch -- --collection pilot --provider elevenlabs
npm run hotel:publish -- --hotel il-san-pietro-positano --version 1 --script-url https://<blob-host>/wah-take.js   # approved only
npm run hotel:freshness                              # claims expiring within 45 days / expired; stale profiles (exit 1 if a clip uses an expired claim)
npm run hotel:publish -- --hotel il-san-pietro-positano --version 1 --script-url <url> --current-only   # repoint takes/<slug>/current/ at an already uploaded version
npm run hotel:list
npm run hotel:review -- --hotel il-san-pietro-positano --version 2 --approve
npm test && npm run typecheck
```

`review --approve` refuses unless the fact check passed, the audio length is within 75–100 s, the profile is `verified`, and the audio is real (not mock or none). Overriding needs `--force --note "why"`.

## Keeping clips current

- **Expiry dates.** Any time-bound claim (a renovation, a "new" opening, an annual ranking or award) carries `"expires": "YYYY-MM-DD"` in its profile, the last day it may be used. Expired claims are withheld from the script writer, `checkScript` rejects any script that cites one, and `review --approve` refuses a version that uses one.
- **Freshness check.** `npm run hotel:freshness` lists claims expiring soon (`--within N` days, default 45) or already expired, and profiles not verified for 90+ days. Hotels are marked `ok`, `watch` or `REFRESH`; it exits 1 when the latest clip relies on an expired claim, so it can run on a schedule.
- **Refreshing a clip:** re-verify the profile (update claims, `last_verified`, `expires`), `hotel:generate`, review and approve the new version, then `hotel:publish`.
- **Stable address.** `publish` uploads the immutable `takes/<slug>/v<N>/` copy and also overwrites `takes/<slug>/current/` (5-minute cache). Hotel pages should embed the `current` transcript URL, so a refreshed clip reaches the page with no page edit; old versions stay in the store for audit. `--no-current` skips that, and `--current-only` repoints `current` at an already uploaded version (also usable to roll back).

## Pronunciation

- **Global rules** (`GLOBAL_PRONUNCIATIONS` in `src/providers/types.ts`) apply to every clip for every hotel. Today: "WhataHotel" is voiced as "What a Hotel". They are respelled in the voiced text only; transcripts and on-page text keep the brand spelling. A hotel can override a global term in its own list.
- **Respelling style:** lowercase, hyphenated syllables (`spah-goh`, `feh-rah-roh's`); no stress capitals, which the voice can read badly. Only single spelled-out letters stay capitals (`P B and G`). A test enforces this. A name already said correctly needs no entry.
- **Per-hotel names** go in the profile's `pronunciations` (`term` -> `say_as`) and are respelled in the voiced text, or handled by an ElevenLabs dictionary when `ELEVENLABS_PRONUNCIATION_DICT_ID` is set (the global rules are respelled either way).

## Editorial rules (enforced in `src/script/rules.ts`)

- **Audio 75–100 s**, checked on the real audio after voicing (`length_check` in `metadata.json`). If a freshly written script lands outside the window, the pipeline rewrites it once with a target word count. `review --approve` refuses an out-of-range version.
- **WhataHotel signature:** every clip ends with the same perks line, spoken word for word by the Luxury Advisor (`PERKS_SIGNATURE` in `src/script/rules.ts`). The pipeline adds it, so the writer never writes perks; it ends on the Candid Traveler's verdict. The line counts toward the word range.
- 205–230 words (eleven_v4 pace is about 2.3–2.7 words/s), 8–12 turns, sections in order: hook → stands_out → best_for → to_know → bottom_line.
- The Candid Traveler must raise at least one sourced consideration.
- Never "pros/cons", "podcast", guarantees, or sales pressure.
- Any number must come from a cited claim.

## Pilot (`data/pilot.json`)

| Type | Hotel |
|---|---|
| Urban | The Peninsula Tokyo |
| Beach | Four Seasons Maui at Wailea |
| Safari | Four Seasons Safari Lodge Serengeti |
| Boutique | Il San Pietro di Positano |
| Family | Four Seasons Orlando at Walt Disney World |

## Data

### Importers

`hotel:import` adds claims to profiles from two read-only sources:

| Source | What is used | Safeguards |
|---|---|---|
| WhataHotel data API `hotel` + `info` | Restaurant names, kept as one fact (`api-restaurants`) | `info` is accepted only when its Amadeus code matches the hotel's, and only if not degraded. HTTP 200 is not trusted (`wahData.status` is checked). Malformed JSON is repaired narrowly. The key is redacted from logs and session tokens are never stored |
| Price Intelligence DB `hotel_research_claim` | Claims read from the hotel's own website, each with its URL | Queried over HTTPS (Neon serverless driver; port 5432 is blocked in the cloud environment), every query READ ONLY. The hotel id and Amadeus code must agree with the API. Keyword-hit rows ("site mentions \"spa\"") are skipped: they are scoring signals, not facts. As of 2026-10-01 all 1,076 rows are of this kind |

Imported claims are tagged with `origin` and get stable ids, so re-running is safe. Curated claims are never changed. Any change sets the profile back to `draft`. Raw snapshots go to `data/sources/<slug>.wah-api.json` and `.pi-db.json`. Amenity codes and `info` prose are kept in those snapshots for reference but are **not** turned into claims: the prose is hotel marketing copy, and its shape has not been measured.

- `data/sources/`: raw whatahotel.com page extracts.
- `data/research/`: per-hotel fact checks with evidence URLs, plus `SITE-COPY-ISSUES.md`, which lists claims on whatahotel.com that are contradicted or unverifiable.
- `data/hotels/`: profiles used by the pipeline. All 5 are `draft` until a person checks their sources and sets `status: "verified"`.
- `data/examples/`: a hand-written sample script, used to preview the format and run offline.

## Roadmap

1. **Phase 1 (this):** schema, script engine, provider abstraction, CLI, pilot profiles.
2. **Phase 2:** five-hotel pilot, three script versions each, voiced with ElevenLabs (chosen provider, 2026-10-02; the Gemini provider stays in the code as an unused fallback).
3. **Phase 3 (built):** "Hear Hotel Highlights" audio widget: a dark pill (with the clip length) that opens a bottom player bar (hotel name, "AI-generated highlights", play/pause, close). `npm run widget:build` bundles `dist/wah-take.js`. Embed with `<script src=".../wah-take.js" data-transcript=".../<slug>/transcript.json"></script>`; audio is `audio.mp3` beside that URL (or set `data-audio`); the transcript is read only for the hotel name; optional `data-image` adds a thumbnail. The transcript and short-version card are not shown. URLs are cleaned of stray backticks, quotes and spaces (a common copy-paste slip), and if the audio cannot load the widget removes itself. A failed load never breaks the page.
4. **Phase 4:** batch generation and publishing to Vercel Blob.
