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

## Ritz-Carlton Bal Harbour (held, batch 4)
The official site says the hotel is temporarily closed from April 6, 2026 to early January 2027 and will reopen as a reimagined resort (new restaurant, spa and members club). Research stopped at the closure check; no profile or clip was made. Redo the research once it reopens.

## Al Bustan Palace, a Ritz-Carlton Hotel (held, batch 4)
The official pages say a renovation began 1 July 2026 with no official reopening date (Condé Nast Traveler says plans to open by 2028). Seven venues are listed as temporarily closed. Research stopped at the closure check; no profile or clip was made. Redo the research once it reopens.

## Aman At Sea (Amangati) (held, Aman batch 1)
WhataHotel ID 7138. A yacht rather than a hotel; held with the other non-hotel entries. Add if wanted.

## Fairmont chain (held, Fairmont batches)
| WhataHotel ID | Name | Reason |
|---|---|---|
| 2520 | Fairmont Heritage Place, Ghirardelli Square | Branded residences, not a hotel |
| 4823 | Fairmont Heritage Place, Mayakoba | Branded residences, not a hotel |
| 6692 | Fairmont Heritage Place, Franz Klammer Lodge | Branded residences, not a hotel |
| 7139 | Orient Express Sailing Yachts | Yacht, not a hotel |
| — | Fairmont Beijing | Closed since 2026-09-16 for full renovation, no reopening date (per fairmont.com banner); redo after reopening |

## Fairmont batch 3
| WhataHotel ID | Name | Reason |
|---|---|---|
| 4850 | The Claremont Resort (Berkeley) | No fairmont.com property page found (search returns only generic Fairmont pages); may no longer be a Fairmont. Held until the official URL is confirmed. |
| — | Fairmont Winnipeg | Paused operations from 1 July 2026 for a full reinvention, reopening spring 2027 (per fairmont.com). Redo after reopening. |
| — | Fairmont Grand Hotel Kyiv | Official page rejected by the identity check only because WhataHotel spells the city "Kiev"; needs hand-confirmation of the fairmont.com URL and an open-status check. |

## Fairmont batch 4
| WhataHotel ID | Name | Reason |
|---|---|---|
| 4967 | Fairmont Makati | Official page (fairmont.com/en/hotels/manila/fairmont-makati.html) rejected by the identity check only because WhataHotel gives the location as "Luzon Island"; shares its building with Raffles Makati. Needs hand-confirmation of the URL and an open-status check. |

## Auberge batch 2

| Hotel | WhataHotel ID | Why held |
| --- | --- | --- |
| Cambridge House, Auberge Collection (London) | 7131 | Not open yet: official pages say "Debuting 2027". Profile it after it opens. |
| Malliouhana, Auberge Collection (Anguilla) | 3706 | Official Auberge page not confirmed: auberge.com/malliouhana/ is a landing page without the property name or Anguilla. |
| Auberge Saint-Antoine (Quebec City) | 2640 | auberge.com/saint-antoine/ returns almost no text; official page not confirmed. |
| Hacienda AltaGracia, Auberge Collection (Costa Rica) | 3039 | auberge.com/hacienda-altagracia/ returns almost no text; official page not confirmed. |
| Grace Santorini, Auberge Collection | 2927 | auberge.com/grace/ returns almost no text; official page not confirmed. |
| Esperanza, Auberge Collection (Cabo San Lucas) | 1215 | auberge.com/esperanza/: only 67% of the name matches and Cabo San Lucas is not mentioned. |
| Susurros del Corazón, Auberge Collection (Mexico) | 6286 | auberge.com/susurros-del-corazon/ returns almost no text; official page not confirmed. |

## Belmond (batches 1 and 2)

| Hotel | WhataHotel ID | Why held |
| --- | --- | --- |
| Romazzino (Costa Smeralda) | 1047 | Belmond page https://www.belmond.com/en/hotels/europe/italy/romazzino-costa-smeralda found, but identity check failed: the page does not mention Porto Cervo (WhataHotel's city). Needs hand-confirmation. |
| Belmond Le Manoir aux Quat'Saisons | 2409 | Official Belmond page (hand-confirmed) says "Closed for Redevelopment", no reopening date. Held until it reopens. |
| Belmond Savute Elephant Lodge | 2463 | Belmond page https://www.belmond.com/en/lodges/africa/botswana/savute-elephant-lodge-chobe-national-park found; identity check failed. Needs hand-confirmation. |
| Belmond Khwai River Lodge | 1676 | Not on belmond.com any more (sitemap lists Savute and Eagle Island only). |
| Belmond La Residence d'Angkor | 2730 | Not on belmond.com any more. |
| Belmond Grand Hotel Europe | 1195 | Not on belmond.com any more. |
| Belmond Napasai | 2513 | Not on belmond.com any more. |
| El Encanto | 2667 | Not on belmond.com any more. |
