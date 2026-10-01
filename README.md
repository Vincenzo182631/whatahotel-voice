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
| `ANTHROPIC_API_KEY` | Writing scripts and fact checking (`claude-opus-5-5`) |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ADVISOR`, `ELEVENLABS_VOICE_TRAVELER` | Text-to-Dialogue voices (`eleven_v3`) |
| `ELEVENLABS_PRONUNCIATION_DICT_ID` | Optional pronunciation dictionary; otherwise profile respellings are used |
| `GEMINI_API_KEY` (+ optional `GEMINI_VOICE_*`, `GEMINI_TTS_MODEL`) | Gemini multi-speaker TTS, for comparison |

## Commands

```bash
npm run hotel:scrape -- --collection pilot          # refresh data/sources/ from whatahotel.com
npm run hotel:validate                              # schema + source-reference checks
npm run hotel:script -- --hotel il-san-pietro-positano          # script only
npm run hotel:generate -- --hotel il-san-pietro-positano --provider elevenlabs
npm run hotel:generate -- --hotel il-san-pietro-positano --provider gemini --from-version 1   # same script, other voices
npm run hotel:generate -- --hotel test --provider mock --script-file my-script.json            # offline
npm run hotel:batch -- --collection pilot --provider elevenlabs
npm run hotel:list
npm run hotel:review -- --hotel il-san-pietro-positano --version 2 --approve
npm test && npm run typecheck
```

`review --approve` refuses unless the fact check passed, the profile is `verified`, and the audio is real (not mock or none). Overriding needs `--force --note "why"`.

## Editorial rules (enforced in `src/script/rules.ts`)

- 165–205 words (about 75 s), 8–12 turns, sections in order: hook → stands_out → best_for → to_know → bottom_line.
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

- `data/sources/`: raw whatahotel.com page extracts.
- `data/research/`: per-hotel fact checks with evidence URLs, plus `SITE-COPY-ISSUES.md`, which lists claims on whatahotel.com that are contradicted or unverifiable.
- `data/hotels/`: profiles used by the pipeline. All 5 are `draft` until a person checks their sources and sets `status: "verified"`.
- `data/examples/`: a hand-written sample script, used to preview the format and run offline.

## Roadmap

1. **Phase 1 (this):** schema, script engine, provider abstraction, CLI, pilot profiles.
2. **Phase 2:** five-hotel pilot, with three script versions each and ElevenLabs vs. Gemini compared on identical scripts.
3. **Phase 3:** script-tag player widget, transcript, and "short version" card.
4. **Phase 4:** batch generation and publishing to Vercel Blob.
