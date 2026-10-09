# Held hotels (to report on later)

## Mandarin Oriental chain (48 requested)
| Hotel | WhataHotel ID | Status | Issue |
|---|---|---|---|
| Mandarin Oriental, Hong Kong (flagship, Connaught Road) | 949 | Published (v1) | Open but mid-renovation (spa at The Landmark). Clip says so, no dates. |
| Villa Caldera (Santorini) | 6691 | Held | Private 4-bedroom Exclusive Home, not bookable online; not a hotel, perks line may not fit. Recommend skip. |
| The Sireya Desaru Coast | 6935 | Held | Same property as Mandarin Oriental, Desaru Coast (7047, already published); renamed 30 Jan 2026. Skip, or reuse the Desaru clip. |

## Other open items
- Perks "combinable" wording check (earlier question).
- Seasonal hotels: Megève, Cap-Ferrat.
- Snippets not yet added in the WhataHotel admin: 42 Four Seasons (batch 7-9, Tamarindo done) and all 45 Mandarin Oriental.
- Synced closed captions not built (transcript panel + JSON-LD are live).

## Closing review (published clips vs verified WhataHotel offers)
See `docs/closing-review.md` (summary and tables) and `exports/closing-review.csv` (every hotel: publish status, what is off, published vs new closing).
Rebuild with `npm run hotel -- offers` then `npx tsx scripts/closing-audit.ts`. Includes the hotels not published or without a profile yet
(Villa Caldera, The Sireya, and four Four Seasons hotels with no profile: Shanghai Puxi, Megève Les Chalets, Santa Barbara Biltmore, Aviara Residence Club).
