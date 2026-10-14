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

27 of the 33 Belmond hotels are live; the 6 below are held, so the Belmond CSV has 27 rows.

| Hotel | WhataHotel ID | Why held |
| --- | --- | --- |
| Belmond Le Manoir aux Quat'Saisons | 2409 | Official Belmond page (hand-confirmed) says "Closed for Redevelopment", no reopening date. Held until it reopens. |
| Belmond Khwai River Lodge | 1676 | Not on belmond.com any more (sitemap lists Savute and Eagle Island only). |
| Belmond La Residence d'Angkor | 2730 | Not on belmond.com any more. |
| Belmond Grand Hotel Europe | 1195 | Not on belmond.com any more. |
| Belmond Napasai | 2513 | Not on belmond.com any more. |
| El Encanto | 2667 | Not on belmond.com any more. |

## Kempinski (collection/4)

14 of the 18 Kempinski hotels are live; the 4 below are held.

| Hotel | Reason |
|---|---|
| Kempinski Adriatic Istria | Official page blank; nothing to ground facts on |
| Kempinski Hotel Bahía Estepona | Too few verifiable facts from official pages |
| Commune by the Great Wall | Too few verifiable facts from official pages |
| Kempinski Hotel Amman | Only a third-party travel article found; no official page |

## Kimpton (collection/87)

25 of the 28 Kimpton hotels are live; the 3 below are held (official page not confirmed).

| Hotel | Reason |
|---|---|
| Kimpton RiverPlace Hotel (Portland) | No official property page found |
| Kimpton Grand Roatan Resort & Spa | No official property page found |
| Kimpton De Witt Amsterdam | No official property page found |

## Langham (collection/30)

11 of the 12 Langham hotels are live; the one below is held.

| Hotel | Reason |
|---|---|
| The Langham, Custom House, Bangkok | Not yet open: official page says stays start 20 December 2026. Redo after opening. |

## Montage (collection/93)

All 6 Montage hotels are live. Palmetto Bluff and Los Cabos were hand-accepted (official pages do not name WhataHotel's city).

## Oetker Collection (collection/63)

All 4 Oetker hotels are live. Jumby Bay was hand-accepted (official page does not name St. John's). WhataHotel lists Jumby Bay as adults-only, but the official site shows a Kids Club; the WhataHotel copy may need fixing.

## Park Hyatt (collection/8)

48 of the 51 hotels are live (Los Cabos and Changbaishan hand-accepted). Held:

| Hotel | Reason |
|---|---|
| Ararat Park Hyatt Moscow | No hyatt.com property page found (only a spa landing page) |
| Hyatt Vancouver Downtown Alberni | Under renovation; Conde Nast says it will reopen as a Park Hyatt (target end of 2026) |
| Park Hyatt Dubai | Official site: long-term enhancement from May 2026; all hotel outlets temporarily closed |

Many WhataHotel Park Hyatt pages contradict the official sites (locations, floors, pools, restaurants), e.g. Toronto, Kuala Lumpur, Jakarta, Chennai, Shenzhen, Guangzhou, Washington, Johannesburg, Bangkok; those claims were not used.

## Peninsula (collection/9)

All 12 hotels are live (Tokyo was published earlier as peninsula-tokyo). WhataHotel's Peninsula pages often contradict the official sites (Rolls-Royce fleets vs BMW/MINI, ESPA spas, helipads, Paris address and rooftop spa); only official facts were used.

## Raffles (collection/11)

20 of 21 hotels done. Hainan, Makati and Makkah Palace were hand-accepted by the user (official raffles.com pages that don't name Sanya / Luzon Island / Mecca).
- Raffles Maldives Meradhoo: held. raffles.com/maldives/ now redirects to the Indian Ocean destinations page, which lists only Raffles Seychelles; no official property page found (likely left the brand).
- WhataHotel contradicts the official sites for Hainan (says Shimei Bay, all-villa with 32 villas; official: Clear Water Bay, rooms/suites/villas) and Makati (Writers Bar on 46th floor and rooftop pool; official: lobby-level bar, 9th-floor pool). Only official facts were used.

## Regent (collection/94)

9 of 10 done.
- Regent Porto Montenegro: held. The user hand-accepted the official page, but every official URL (regenthotels.com/regent-portomontenegro/, ihg.com .../tivpm/hoteldetail in US and GB locales) redirects to a generic IHG "Where to Next" landing page, so no property facts could be read. Retry later.
- Shanghai on the Bund was first auto-matched to Regent Shanghai Pudong's site; rerun with ihg.com .../shanghai/shabn/hoteldetail. Cannes uses ihg.com .../cannes/ceqha/hoteldetail.
- WhataHotel contradicts official sites for Hong Kong (Yan Toh Heen vs Lai Ching Heen, Rolls-Royce transfers), Bali Canggu (clifftop, Pura Batu Bolong), Taipei (Silks Palace, address), Bund (1930s Art Deco origins, rooftop restaurant, spa), Santa Monica (direct beach access). Only official/editorial facts used.

## Rocco Forte (collection/14)

All 14 done. The Carlton Milano hand-accepted by the user (official page names it "The Carlton Milan"); only its home page was readable.
- Hotel de Rome (Berlin): official pages were unreadable; script is sourced from Condé Nast Traveler only.
- Rocco Forte House Rome: WhataHotel's page is badly wrong (1930s villa in Parioli, 15 suites, rooftop restaurant); official: 18th-century palazzo at 114 Via del Babuino, five apartments, no restaurant. WhataHotel copy needs correcting.
- Other WhataHotel contradictions: The Charles (Old Town/Frauenkirche, "Michelin-starred Sophia's"), Brown's (1837, HIX Mayfair), de la Ville (Mosaico rooftop), Amigo (Belgian comic art at Bocconi), Balmoral (Number One Michelin star; official says Michelin Guide-recommended), Savoy (rooftop bar), Verdura villas (three courses, IRENE Spa), House Milan (14 suites vs 11 apartments).

## Rosewood (collection/10)

All 42 published. Hand-accepted by the user (official page lacks WhataHotel's city name): Kauri Cliffs, Matakauri, Bermuda, Cape Kidnappers, Kona Village, Mandarina, Miyakojima, Las Ventanas, Baha Mar.
- rosewoodhotels.com sub-pages mostly scrape as homepage copies, so many profiles rest on the official homepage + dining page + Condé Nast Traveler.
- WhataHotel page errors worth fixing: The Chancery Rosewood page describes Rosewood London (Holborn) instead of the former US Embassy on Grosvenor Square; Sao Paulo neighborhood (Vila Madalena/Cidade Jardim vs Bela Vista); Sand Hill city (Palo Alto vs Menlo Park); Bangkok (Lakorn/spa floors); Phnom Penh (Iza is Japanese, not Khmer); Villa Magna ("Flor de Caña" not a venue); Beijing (Red Bowl is hot pot, not Peking duck); San Miguel (new build 2011, not a convent); Mayakoba (1,600 vs 620 acres); Castiglion (4,200 vs 5,000 acres); Bermuda (one golf club, Hamilton Parish).

## SLS (collection/92)

6 of 7 done. Baha Mar, Dubai and Puerto Madero hand-accepted by the user.
- SLS Beverly Hills: held. slshotels.com/beverly-hills/ is a single page with no sub-pages and no CNT review; only 8 thin facts. WhataHotel names Bazaar Meat, which the official page doesn't list (LADiDa Rooftop instead).
- WhataHotel contradictions: Barcelona (Eixample/Starck vs Port Fòrum in Sant Adrià de Besòs, b720 design); Dubai (Starck vs Paul Bishop/Aedas, José Andrés venues not listed, Business Bay not Downtown); Cancún (Starck vs Piero Lissoni, rooftop lagoon pool vs Gulf infinity pool); Playa Mujeres (called adults-only, but has kids/teen clubs); Baha Mar (Bazaar not listed; ~15 min from downtown Nassau, not steps).

## St. Regis (collection/16)

56 of 59 done. Location-only official-URL mismatches hand-accepted by the user ("accept all such").
- Held: St. Regis Moscow Nikolskaya (Marriott has exited Russia; no official page). Dubai The Palm (closed, reopening 1 Nov 2026). Houston (renamed Houston Grand Hotel – River Oaks; no longer a St. Regis).
- Bahia Beach: official page didn't load; script sourced only from an undated Condé Nast Traveler review.
- WhataHotel page errors: Hong Kong page describes The Ritz-Carlton Hong Kong; Mexico City (Polanco vs Reforma 439, Cuauhtémoc); Riyadh (KAFD vs Diplomatic Quarter); London (Belgravia vs 37 Conduit St, Mayfair); Longboat Key (no golf on property); Aruba (Surfside vs Palm Beach); Costa Mujeres (distances, overwater suites); Aspen ("only ski-in", Remède spa, 5-star vs 4-star with RAKxa spa).

## Dorchester Collection (collection/37)

All 9 published.
- Principe di Savoia (Milan): Condé Nast Traveler says it closes 1 Jan 2027 for restoration, reopening 2029 (not on the official site). The script mentions it; consideration expires 2027-01-01, so re-check/unpublish then.
- WhataHotel page errors: The Dorchester (claims its own daylit spa pool; official: guests use 45 Park Lane's pool); 45 Park Lane ("largest suites, 3,000 sq ft" vs 1,829 sq ft top suite; robatayaki at CUT); Beverly Hills Hotel (postcode 9641 vs 90210; "Cabana Club"); Bel-Air (Wolfgang Puck/Michelin); Plaza Athénée (Alain Ducasse restaurant now La Grande Table); Le Meurice (tea in Bar 228 vs Le Dalí); Eden (Michelin star at Il Giardino vs La Terrazza; "top of Spanish Steps"); The Lana (DIFC vs Business Bay; Stay by Yannick Alléno not listed).

## Thompson (collection/75)

15 of 16 published.
- Thompson Miami Beach: held. No Thompson property page; Hyatt newsroom says the hotel was acquired and rebranded as The Confidante (Unbound Collection).
- Offers: WhataHotel pages print both $100 and $200 credits; closings use the hotel perks table ($100). The offers check reads WhataHotel's Hyatt Centric collection page as the chain page.
- WhataHotel page errors: The Beekman (address 5 Beekman St vs 123 Nassau St; Keith McNally/Augustine vs Colicchio/Boulud venues); Gild Hall (gothic guildhall vs midcentury Walrod design); The Cape (adults-only, swimmable beach, Japanese Manta); Zihuatanejo (clifftop/adults-only vs beachfront Playa La Ropa); Savannah (Bull St vs 201 Port St; rooftop bar is Bar Julian, not Fleeting); Central Park (57th St vs 119 W 56th St); Denver (Golden Triangle vs LoDo); Dallas (Deep Ellum/Arts District vs Main Street District; Catbird is 10th floor); Austin (Lady Bird Lake views, 2nd Street); Madrid (Justicia/Prado vs Plaza del Carmen); Washington DC (downtown vs Navy Yard); Chicago (rooftop bar not listed). Several pages claim rooftop bars the official sites don't list.

## Trump Hotels (collection/42)

All 5 published. Doonbeg hand-accepted by the user (trumphotels.com/ireland doesn't mention County Clare).
- Time-bound: Doral script mentions the PGA Tour returning March 2027 (expires 2027-03-07); Doonbeg mentions a Jan 4 - Feb 4, 2027 course closure (expires 2027-02-05). Re-check after those dates.
- WhataHotel page errors: Las Vegas ("all-suite" vs 1,282 rooms/352 suites; rooftop pool vs 7th-floor deck; DJT on 64th floor); Chicago (98 vs 92 stories; "Terrace at Trump" vs Terrace 16); Doral (50,000 vs 48,000 sq ft spa; WGC-Cadillac vs LIV/PGA Tour; Gil Hanse credited for all courses); Doonbeg ("clifftop castle" vs dunes-side manor, Greg Norman vs Martin Hawtree); New York (floors 3-17, "largest suites in NYC" unsupported).
