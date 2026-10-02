# Phase 2 pilot shortlist

One recommended version per hotel for human review. Rebuilt 2026-10-02 from the latest regenerated versions (corrected profiles, fixed WhataHotel signature line, audio 75-100 s). Voices: Roger (Luxury Advisor), Jessica (Candid Traveler), ElevenLabs `eleven_v4`.

All five profiles are still `draft`: nothing can be approved until a person checks each profile's sources and sets `status: "verified"`. Several claims also need a browser check (see `data/research/OFFICIAL-SITE-CHECK.md`). "Fact check" below is the automated pass only.

| Hotel | Pick | Words | Audio | Fact check | Runner-up |
|---|---|---|---|---|---|
| Il San Pietro di Positano | v24 | 220 | 87.3 s | passed | v25 (90.9 s) |
| The Peninsula Tokyo | v19 | 219 | 89.2 s | passed | v20 (89.5 s) |
| Four Seasons Maui at Wailea | v20 | 223 | 90 s | passed | v18 (91.6 s) |
| Four Seasons Safari Lodge Serengeti | v17 | 224 | 88.8 s | passed | v18 (90.5 s) |
| Four Seasons Orlando at Walt Disney World | v17 | 219 | 83.7 s | passed | v19 (85.3 s) |

## Notes

- Voiced on `eleven_v4`. 14 of the 15 latest versions passed the fact check and the 75-100 s length check; Il San Pietro v26 failed (it called the hotel Relais & Châteaux before the profile had that claim; f-9 now covers it) and was not considered. Picks are closest to 75 s; ties go to the earlier version.
- Every clip ends with the same WhataHotel signature line (perks p-1 to p-3), word for word, spoken by the Luxury Advisor and added by the pipeline.
- Claims still needing a browser check are listed in `data/research/OFFICIAL-SITE-CHECK.md` (for example Tokyo airport times, Maui kids' programme hours).


## Il San Pietro di Positano — v24

Audio: `data/shortlist/il-san-pietro-positano-v24.mp3` (source `output/il-san-pietro-positano/v24`). Profile status: `draft`, last verified 2026-10-01.

**Short version card**

- best_for: Couples and food lovers happy to stay on property
- atmosphere: Cliffside terraces stepping down to a private beach
- worth_knowing: Seasonal, ages 10+, shuttle needed to reach town

**Transcript**

- **Luxury Advisor**: Il San Pietro di Positano starts with a 17th-century chapel at the entrance. Everything else steps down the cliff below it.  
  _claims: f-4_
- **Candid Traveler**: So you're really staying in the cliff.  
  _claims: f-4_
- **Luxury Advisor**: Exactly. Around fifty-seven rooms, suites and villas, each with a private sea-view terrace. And an elevator carved into the rock takes you down to the private beach and Carlino, the beachside restaurant.  
  _claims: f-1, h-1_
- **Candid Traveler**: And the food goes further than that.  
  _claims: h-2_
- **Luxury Advisor**: Much further. Zass has a Michelin star, ten organic garden terraces supply the kitchens, and the hotel holds Three MICHELIN Keys. There's even a complimentary late-morning cruise on the hotel's boats.  
  _claims: h-2, f-5, f-2, h-3_
- **Candid Traveler**: So, honestly, couples and food lovers.  
  _claims: h-2, f-5_
- **Luxury Advisor**: Couples happy to stay put. There's a heated pool, a seaside tennis court and a spa with hammam.  
  _claims: h-4_
- **Candid Traveler**: That's the thing, though. It's outside town, so dinner in Positano means the free 24-hour shuttle. Kids must be ten or older, and it closes in winter.  
  _claims: c-3, f-6, c-2, c-1_
- **Luxury Advisor**: And plan arrival. The road from Naples can be congested, so the concierge recommends car plus boat.  
  _claims: c-5, f-7_
- **Candid Traveler**: Bottom line: it's right for couples who want the cliff, the sea and serious food. Families with young children, or anyone who wants to walk into town, should look elsewhere.  
  _claims: f-4, h-2, c-2, c-3_
- **Luxury Advisor**: With the WhataHotel Preferred Rate, you get free breakfast for two daily, a priority upgrade if available at check-in, and a $100 hotel credit.  
  _claims: p-1, p-2, p-3_

**Claims to verify against sources**

- `c-1`: Seasonal hotel, closed in winter: it generally opens in April and closes in October.
- `c-2`: Children are welcome only from age 10.
- `c-3`: It sits outside Positano town, so reaching restaurants and shops in the centre means using the free 24-hour shuttle.
- `c-5`: The road from Naples along the Amalfi Coast can be congested. The hotel recommends a car-plus-boat transfer.
- `f-1`: The hotel has about 57-58 rooms, suites and villas, each with a private sea-view terrace.
- `f-2`: Awarded Three MICHELIN Keys, one of only eight Italian hotels with three Keys in the first (2024) selection.
- `f-4`: A small 17th-century chapel dedicated to San Pietro marks the entrance, and the hotel steps down the cliff below it.
- `f-5`: Ten cascading organic garden terraces supply the kitchens. The bars include the Terrace Bar and L'Alcova (next to Zass).
- `f-6`: A complimentary 24-hour shuttle runs into Positano centre, a few minutes away.
- `f-7`: Transfers from Naples are arranged by the concierge. A car-plus-boat option is recommended to avoid coastal traffic.
- `h-1`: An elevator carved into the rock leads to the private beach and sea platforms, which have a solarium, bar and the beachside Carlino restaurant.
- `h-2`: Zass holds one Michelin star under chef Alois Vanlangenaeker.
- `h-3`: The hotel's boats The Dreamer (51 ft) and Joey II (44 ft) run a complimentary 11:30 a.m. cruise with swimming and cocktails, May to mid-October.
- `h-4`: Facilities include a heated outdoor pool, a seaside tennis court between the cliffs, and The Spa at Il San Pietro with hammam.
- `p-1`: With the WhataHotel Preferred Rate, breakfast for two is free daily (the standard published rate is room only, with breakfast usually extra).
- `p-2`: With the WhataHotel Preferred Rate, guests get a priority upgrade if available at check-in.
- `p-3`: With the WhataHotel Preferred Rate, guests get a $100 hotel credit.

**Sources**

- Relais & Châteaux - Il San Pietro di Positano: https://www.relaischateaux.com/us/hotel/il-san-pietro-di-positano/
- MICHELIN Guide - Every Three Key Hotel in Italy: https://guide.michelin.com/us/en/article/travel/every-three-key-hotel-italy-michelin-guide-2024
- Il San Pietro - FAQ: https://www.ilsanpietro.com/faq/
- Positano.com - Zass: https://www.positano.com/en/c/zass
- Il San Pietro - Restaurants & bars: https://www.ilsanpietro.com/restaurants-and-bars/

## The Peninsula Tokyo — v19

Audio: `data/shortlist/peninsula-tokyo-v19.mp3` (source `output/peninsula-tokyo/v19`). Profile status: `draft`, last verified 2026-10-01.

**Short version card**

- best_for: First-time Tokyo visitors, shoppers, food lovers and dog owners
- atmosphere: Art-filled city tower facing the Imperial Palace gardens
- worth_knowing: Fly into Haneda; palace views depend on room category

**Transcript**

- **Luxury Advisor**: The Peninsula Tokyo faces the Imperial Palace gardens and Hibiya Park, with Ginza about three minutes on foot. That location is the story.  
  _claims: h-1, f-2_
- **Candid Traveler**: Right, and it's very much a city address. Dense business and shopping district, not a resort.  
  _claims: c-1_
- **Luxury Advisor**: Sure, but look inside. Over a thousand artworks by Japanese artists. And Peter, on the top floor, now Modern French under Chef Yohan Da Costa. It's Forbes Five-Star, too.  
  _claims: f-7, h-2, f-4_
- **Candid Traveler**: Don't skip the cars. Rolls-Royce Phantoms, plus MINIs that give suite guests complimentary chauffeured rides.  
  _claims: h-4_
- **Luxury Advisor**: It suits first-time visitors and luxury shoppers. Food-focused couples too, between Peter, Cantonese at Hei Fung Terrace, and the mango pudding at the café.  
  _claims: f-2, h-2, f-5, f-6_
- **Candid Traveler**: And dog owners. It's pet-friendly, with an actual dog menu.  
  _claims: f-7_
- **Luxury Advisor**: Business travelers too, with a direct entrance to Hibiya station.  
  _claims: h-1_
- **Candid Traveler**: A few things, though. Fly into Haneda; it's about forty minutes by bus, Narita's closer to ninety. Views depend on room category. And reviews calling Peter a steakhouse are out of date.  
  _claims: c-2, f-3, c-5, c-4_
- **Luxury Advisor**: Fair. The pool's indoors, too, but the vitality pool looks out on the palace gardens.  
  _claims: c-3, h-3_
- **Candid Traveler**: So, book it if you want Ginza, serious dining and the palace gardens on your doorstep. Want a resort? Look elsewhere.  
  _claims: f-2, h-2, h-1, c-1_
- **Luxury Advisor**: With the WhataHotel Preferred Rate, you get free breakfast for two daily, a priority upgrade if available at check-in, and a $100 hotel credit.  
  _claims: p-1, p-2, p-3_

**Claims to verify against sources**

- `c-1`: The hotel is in a dense city-centre business and shopping district (Marunouchi/Yurakucho), not a resort setting. Green space means Hibiya Park and the palace gardens across the street.
- `c-2`: Narita is about 90 minutes away by airport bus. Haneda (about 40 minutes) is much more convenient for this hotel.
- `c-3`: The pool is indoors.
- `c-4`: Peter changed concept in October 2025 (steak and grill to Modern French tasting and à la carte menus). Older reviews describing a steakhouse are out of date.
- `c-5`: Palace and park views depend on room category.
- `f-2`: Ginza is about a three-minute walk away.
- `f-3`: Haneda Airport is about 8.8 miles away (around 40 minutes by airport bus); Narita is about 35.7 miles (around 90 minutes by bus).
- `f-4`: Forbes Travel Guide Five-Star hotel.
- `f-5`: Hei Fung Terrace (2nd floor) serves Cantonese cuisine.
- `f-6`: Other dining: afternoon tea in The Lobby with live music, and The Peninsula Boutique & Café, known for its mango pudding.
- `f-7`: More than 1,000 artworks by about 60 Japanese artists are displayed throughout; the hotel is pet-friendly and has a dog menu.
- `h-1`: Address 1-8-1 Yurakucho, Chiyoda-ku, opposite the Imperial Palace gardens and Hibiya Park, with a direct entrance to Hibiya subway station.
- `h-2`: Peter, on the top (24th) floor, relaunched on 1 October 2025 as a Modern French restaurant under Chef Yohan Da Costa, with Peter: The Bar alongside.
- `h-3`: The hotel has an indoor heated pool of about 20 m and a vitality pool overlooking the Imperial Palace gardens.
- `h-4`: The house-car fleet includes Rolls-Royce Phantoms and custom MINI Cooper S Clubmans. The MINIs offer complimentary chauffeured rides for suite guests (up to 3 hours within 10 km).
- `p-1`: With the WhataHotel Preferred Rate, breakfast for two is free daily (the standard published rate is room only, with breakfast usually extra).
- `p-2`: With the WhataHotel Preferred Rate, guests get a priority upgrade if available at check-in.
- `p-3`: With the WhataHotel Preferred Rate, guests get a $100 hotel credit.

**Sources**

- American Express Travel - The Peninsula Tokyo: https://www.americanexpress.com/en-us/travel/discover/property/Japan/Tokyo/The-Peninsula-Tokyo
- Forbes Travel Guide - The Peninsula Tokyo: https://www.forbestravelguide.com/hotels/tokyo-japan/the-peninsula-tokyo
- The Peninsula Tokyo Unveils a Modern French Dining Concept at Peter: https://www.peninsula.com/en/newsroom/tokyo/news/peter-concept-change
- 2025 Michelin Tokyo Chinese Restaurant: Hei Fung Terrace: https://lastminutejapan.com/hei_fung_terrace
- Booking.com - The Peninsula Tokyo: https://www.booking.com/hotel/jp/the-peninsula-tokyo.html
- Japan Today - Peninsula Tokyo receives 2 MINI Cooper S Clubman cars: https://japantoday.com/category/features/travel/peninsula-tokyo-receives-2-mini-cooper-s-clubman-cars?comment-order=latest

## Four Seasons Maui at Wailea — v20

Audio: `data/shortlist/four-seasons-maui-v20.mp3` (source `output/four-seasons-maui/v20`). Profile status: `draft`, last verified 2026-10-01.

**Short version card**

- best_for: Families with kids 5+, couples and winter whale watchers
- atmosphere: Full-service oceanfront resort on Wailea Beach with an adults-only infinity pool
- worth_knowing: Guest-room renovation reported to run to around mid-December 2026; confirm room status

**Transcript**

- **Luxury Advisor**: Let's talk Four Seasons Maui at Wailea. The one thing to understand? It's a classic oceanfront resort in the middle of a transformation.  
  _claims: f-1, f-6, c-1_
- **Candid Traveler**: Start with what isn't changing.  
  _claims: —_
- **Luxury Advisor**: Fifteen oceanfront acres on Wailea Beach, which Dr. Beach ranked fourth in the US for 2026. And the building's a U-shape, so most rooms look at the Pacific.  
  _claims: f-1, h-1, f-2, c-2_
- **Candid Traveler**: Right. And the Serenity Pool, adults-only, infinity edge, underwater music. Very White Lotus, since Season 1 filmed here.  
  _claims: h-2, f-7_
- **Luxury Advisor**: And the new pieces? Kai Holo Spa has hydrotherapy pools, a cold plunge, infrared saunas. And KOMO does Japanese dinners with a fourteen-seat sushi bar.  
  _claims: h-3, f-5_
- **Candid Traveler**: So who's it really for?  
  _claims: —_
- **Luxury Advisor**: Families with kids five and up. Kids For All Seasons is complimentary, nine to five daily. And couples in winter, when humpbacks peak January to March.  
  _claims: h-4, f-8_
- **Candid Traveler**: Here's my caution. Guest rooms are being renovated, reportedly finishing around mid-December, so an autumn stay could overlap with construction. Confirm your room's status.  
  _claims: c-1_
- **Luxury Advisor**: Fair. Entry-level rooms face the mountain; ocean views mean booking up.  
  _claims: c-3_
- **Candid Traveler**: The beach is public, and you walk through the lobby and pools to reach it.  
  _claims: c-2_
- **Candid Traveler**: Bottom line? Winter whale watchers, families with kids five and up, beach-loving couples. Just time it around the renovation.  
  _claims: f-8, h-4, h-1, c-1_
- **Luxury Advisor**: With the WhataHotel Preferred Rate, you get free breakfast for two daily, a priority upgrade if available at check-in, and a $100 hotel credit.  
  _claims: p-1, p-2, p-3_

**Claims to verify against sources**

- `c-1`: Guest-room renovation, under way since March 2026, is reported to finish around mid-December 2026, and the resort says refreshed guest rooms and suites debut in Q4 2026, so stays this autumn may coincide with construction work. Confirm room status when booking.
- `c-2`: Wailea Beach is public by Hawaii law, and reaching it from rooms means walking through the lobby and pool areas.
- `c-3`: Entry-level rooms are mountain-side; ocean views mean booking a higher category.
- `f-1`: 383 rooms and suites on 15 oceanfront acres. Opened 9 February 1990.
- `f-2`: Eight-storey U-shaped building gives most rooms Pacific views. Kahului Airport (OGG) is about 25 minutes away.
- `f-5`: KOMO, a 50-seat Japanese restaurant with a 14-seat sushi bar under Chef Kiyokuni Ikeda, was announced in February 2025 and serves dinner 5-9pm.
- `f-6`: A redesigned 26-room Club Floor with private lounge opened in May 2026, designed by Meyer Davis, as part of a resort-wide transformation.
- `f-7`: Filming location for Season 1 of HBO's The White Lotus.
- `f-8`: Humpback whales are seen in Maui waters from about November into spring, with the usual peak January to March.
- `h-1`: Wailea Beach ranked No. 4 on Dr. Beach's 2026 list of best US beaches.
- `h-2`: Three saline pools, including the adults-only Serenity Pool, an infinity-edge pool with underwater music and bubble loungers.
- `h-3`: Kai Holo Spa was introduced in July 2026. It has three hydrotherapy pools (vitality, therapeutic hot pool, cold plunge), a steam room, a sensory experience shower, traditional and infrared saunas, a redesigned longevity centre and an infrared Movement Studio.
- `h-4`: Kids For All Seasons is complimentary, daily 9am-5pm, for ages 5 and up. Children 4 and under eat free at Ferraro's, DUO, the Lobby Lounge and KOMO with a dining adult.
- `p-1`: With the WhataHotel Preferred Rate, breakfast for two is free daily (the standard published rate is room only, with breakfast usually extra).
- `p-2`: With the WhataHotel Preferred Rate, guests get a priority upgrade if available at check-in.
- `p-3`: With the WhataHotel Preferred Rate, guests get a $100 hotel credit.

**Sources**

- Four Seasons Resort Maui - Wikipedia: https://en.wikipedia.org/wiki/Four_Seasons_Resort_Maui
- Hawaii Tourism Authority (GoHawaii) listing: https://www.gohawaii.com/listing/four-seasons-resort-maui-at-wailea/83
- CNN - Dr. Beach top 10 US beaches 2026: https://edition.cnn.com/2026/05/21/travel/top-10-us-beaches-2026-dr-beach
- Forbes Travel Guide - Four Seasons Resort Maui at Wailea: https://www.forbestravelguide.com/hotels/maui-hawaii/four-seasons-resort-maui-at-wailea
- Maui Now - Four Seasons unveils Komo: https://mauinow.com/2025/02/04/four-seasons-resort-maui-at-wailea-unveils-komo-dining-destination/
- Mann Publications - Kai Holo Spa: https://www.mannpublications.com/mannabouttown/2026/07/23/four-seasons-resort-maui-at-wailea-introduces-kai-holo-spa-a-wellness-sanctuary-inspired-by-the-flow-of-the-island/
- Four Seasons Maui - Family: https://www.fourseasons.com/maui/services-and-amenities/family/
- Four Seasons Press Room - Club Floor: https://press.fourseasons.com/maui/hotel-news/2026/renovated-club-floor-and-lounge/
- Hawaii Guide - Whale season: https://www.hawaii-guide.com/whale-season
- The Luxury Editor - Four Seasons Resort Maui: https://theluxuryeditor.com/accommodation/four-seasons-resort-maui-at-wailea/
- Four Seasons Press Room - Kai Holo Spa: https://press.fourseasons.com/maui/hotel-news/2026/kai-holo-spa/
- Four Seasons Press Room - KOMO: https://press.fourseasons.com/maui/hotel-news/2025/new-komo-restaurant/
- Four Seasons Press Room - Pantry Maui: https://press.fourseasons.com/maui/hotel-news/2026/pantry-maui/
- Elli Travel - Four Seasons Resort Maui at Wailea 2026: https://ellitravel.com/post/our-seasons-resort-maui-wailea-2026

## Four Seasons Safari Lodge Serengeti — v17

Audio: `data/shortlist/four-seasons-serengeti-v17.mp3` (source `output/four-seasons-serengeti/v17`). Profile status: `draft`, last verified 2026-10-01.

**Short version card**

- best_for: Families on a first safari and travelers wanting resort comforts in the bush
- atmosphere: Full-service lodge with an infinity pool overlooking an elephant waterhole
- worth_knowing: Herds pass nearby May-June and November-December; February calving is further south

**Transcript**

- **Luxury Advisor**: Four Seasons Safari Lodge Serengeti sits inside central Serengeti National Park. The thing to understand? It's a full-service lodge with real resort comforts, right in the bush.  
  _claims: f-2_
- **Candid Traveler**: And the wildlife comes pretty close, doesn't it?  
  _claims: c-4_
- **Luxury Advisor**: Very. The infinity pool overlooks an active waterhole that elephants visit, and Horizon Rooms face it. One review notes Terrace Suites have private plunge pools.  
  _claims: h-1, f-6_
- **Candid Traveler**: What about off-drive time?  
  _claims: —_
- **Luxury Advisor**: There's the Kani Spa with six treatment pavilions, and a Discovery Centre with museum-quality exhibits and a lecture hall.  
  _claims: h-2, h-3_
- **Candid Traveler**: So who's it really for?  
  _claims: —_
- **Luxury Advisor**: Families on a first safari. Kijana Klub runs supervised activities for kids eight and over. And anyone who wants resort comforts between game drives.  
  _claims: f-5_
- **Candid Traveler**: Timing matters, though. Herds pass this area around May to June and November to December. February calving happens further south, so that means long drives or a different camp.  
  _claims: c-1_
- **Luxury Advisor**: Fair. And it's the public park, not a private concession, so you'll share popular sightings with other vehicles.  
  _claims: c-2_
- **Candid Traveler**: Plus the journey: a light-aircraft flight to Seronera, then about fifty minutes by Land Cruiser. Or roughly eight hours by road.  
  _claims: c-3, f-3_
- **Candid Traveler**: Book it for a family's first safari or a comfortable stay when herds pass through. Chasing calving? Choose another camp.  
  _claims: f-5, c-1_
- **Luxury Advisor**: With the WhataHotel Preferred Rate, you get free breakfast for two daily, a priority upgrade if available at check-in, and a $100 hotel credit.  
  _claims: p-1, p-2, p-3_

**Claims to verify against sources**

- `c-1`: Per a third-party review, herds pass the Seronera area around May-June and November-December; February calving takes place further south on the short-grass plains. Visiting for calving or river crossings means long drives or a different camp.
- `c-2`: The lodge is in the public national park, not a private concession, so game drives share roads with other vehicles at popular sightings.
- `c-3`: Getting there takes a light-aircraft flight to Seronera plus about a 50-minute drive, or roughly 8 hours by road from Arusha.
- `c-4`: Wildlife is close: elephants drink at the waterhole next to the pool, and movement around the lodge is on elevated walkways with Maasai security.
- `f-2`: Located in central Serengeti National Park, a UNESCO World Heritage Site.
- `f-3`: Access is a roughly 50-minute flight from Arusha to Seronera Airstrip (SEU), then about 50 minutes by Land Cruiser. Driving from Arusha via Ngorongoro and Naabi Gate takes about 8 hours.
- `f-5`: Kijana Klub is a kids' and teens' programme (ages 8 and over) with supervised activities.
- `f-6`: Per a third-party review, Terrace Suites have private infinity plunge pools and Horizon Rooms face the waterhole.
- `h-1`: An outdoor infinity pool overlooks an active waterhole frequented by elephants.
- `h-2`: Serengeti Kani Spa has six treatment pavilions; the signature treatment is the 90-minute Kifa Massage.
- `h-3`: The Discovery Centre has museum-quality exhibits and a lecture hall.
- `p-1`: With the WhataHotel Preferred Rate, breakfast for two is free daily (the standard published rate is room only, with breakfast usually extra).
- `p-2`: With the WhataHotel Preferred Rate, guests get a priority upgrade if available at check-in.
- `p-3`: With the WhataHotel Preferred Rate, guests get a $100 hotel credit.

**Sources**

- Four Seasons Press Room - Safari Lodge Serengeti fact sheet: https://press.fourseasons.com/serengeti/hotel-facts/
- Five Star Alliance - Four Seasons Safari Lodge Serengeti: https://www.fivestaralliance.com/luxury-hotels/arusha/four-seasons-safari-lodge-serengeti
- Four Seasons Safari Lodge Serengeti Review 2026: https://www.privatetourscapetown.com/blog/four-seasons-safari-lodge-serengeti-review

## Four Seasons Orlando at Walt Disney World — v17

Audio: `data/shortlist/four-seasons-orlando-v17.mp3` (source `output/four-seasons-orlando/v17`). Profile status: `draft`, last verified 2026-10-01.

**Short version card**

- best_for: Families doing Disney in luxury, plus couples and golfers
- atmosphere: Full resort on Disney property with a five-acre water park
- worth_knowing: Magic Kingdom is about three miles by complimentary coach; kids' camp is ages 4-12

**Transcript**

- **Luxury Advisor**: Four Seasons Orlando sits on Walt Disney World property, and the thing to understand is it's a full resort in its own right.  
  _claims: f-2, h-1, f-5, f-7, f-6_
- **Candid Traveler**: So a Disney hotel that doesn't want you leaving?  
  _claims: —_
- **Luxury Advisor**: Partly. Explorer Island is a heated five-acre water park, lazy river with rapids, two slides. Then five pools total, a Tom Fazio golf course and an eighteen-room spa.  
  _claims: h-1, f-5, f-7, f-6_
- **Candid Traveler**: But people come for the parks.  
  _claims: —_
- **Luxury Advisor**: Right. Guests get thirty minutes of early theme park entry daily, plus complimentary motor coaches. And Capa, the Spanish steakhouse, has fireworks views from its rooftop terrace.  
  _claims: h-2, h-4, c-4_
- **Candid Traveler**: That's a strong family case.  
  _claims: —_
- **Luxury Advisor**: It is. Kids For All Seasons is a complimentary daily camp for ages four to twelve. Couples get Oasis, the lakeside infinity pool for twenty-one and over.  
  _claims: h-3, f-5, c-3_
- **Candid Traveler**: Two things, though. Magic Kingdom's about three miles away, and the coach drops you at the Ticket and Transportation Center for the monorail. And Capa lost its Michelin star in the 2026 guide.  
  _claims: c-1, c-2_
- **Luxury Advisor**: Fair. It's Michelin Recommended now, and it held a star from 2022 to 2025.  
  _claims: h-4, c-2_
- **Candid Traveler**: So book it for Disney with a real resort to come back to. With kids under four, though, the camp won't cover them.  
  _claims: h-2, h-1, c-5_
- **Luxury Advisor**: With the WhataHotel Preferred Rate, you get free breakfast for two daily, a priority upgrade if available at check-in, and a $100 hotel credit.  
  _claims: p-1, p-2, p-3_

**Claims to verify against sources**

- `c-1`: Magic Kingdom is about three miles away. Guests use the hotel's complimentary motor coach, and Magic Kingdom guests are dropped at the Ticket & Transportation Center for the monorail.
- `c-2`: Capa lost its Michelin star in the 2026 Florida guide (now Recommended). Older copy calling it Michelin-starred is out of date.
- `c-3`: The Oasis pool is adults 21+ only. Families use Explorer Island and the family pool.
- `c-4`: Fireworks are visible from Capa's rooftop terrace.
- `c-5`: The kids' club is for ages 4-12.
- `f-2`: Located in the Golden Oak community on Walt Disney World property, at 10100 Dream Tree Blvd., Lake Buena Vista, about three miles from Magic Kingdom.
- `f-5`: Oasis is an infinity-edge lakeside pool for guests 21 and over; the resort has five pools in total.
- `f-6`: The spa has 18 treatment rooms.
- `f-7`: Tranquilo Golf Course is a Tom Fazio design (par 71, 6,968 yards) and a certified Audubon sanctuary.
- `h-1`: Explorer Island is a heated five-acre water park with a lazy river with rapids and two water slides.
- `h-2`: Guests get Early Theme Park Entry (30 minutes early daily) and complimentary luxury motor coach transportation to the Disney parks.
- `h-3`: Kids For All Seasons is a complimentary daily camp for ages 4-12 at The Mansion on Explorer Island.
- `h-4`: Capa, the Spanish steakhouse with a rooftop terrace for fireworks views, held a Michelin star 2022-2025 and is Michelin Recommended in the 2026 Florida guide.
- `p-1`: With the WhataHotel Preferred Rate, breakfast for two is free daily (the standard published rate is room only, with breakfast usually extra).
- `p-2`: With the WhataHotel Preferred Rate, guests get a priority upgrade if available at check-in.
- `p-3`: With the WhataHotel Preferred Rate, guests get a $100 hotel credit.

**Sources**

- Four Seasons Press Room - Orlando fact sheet: https://press.fourseasons.com/orlando/hotel-facts/
- Four Seasons Press Room - Spring 2026 programming: https://press.fourseasons.com/orlando/hotel-news/2026/spring-programming/
- Visit Orlando blog - Best Resorts in Orlando: https://www.visitorlando.com/blog/post/best-resorts-hotels-orlando/
- List of Michelin-starred restaurants in Florida - Wikipedia: https://en.wikipedia.org/wiki/List_of_Michelin-starred_restaurants_in_Florida
- Four Seasons Orlando - Kids Program: https://www.fourseasons.com/orlando/services-and-amenities/family/
- Magic Guides - Orlando hotels with Disney shuttle service: https://magicguides.com/hotels-with-disney-world-shuttles/
- Visit Orlando - 2026 MICHELIN Florida Guide: https://www.visitorlando.org/media/press-releases/post/60-orlando-restaurants-recognized-in-2026-michelin-florida-guide/
