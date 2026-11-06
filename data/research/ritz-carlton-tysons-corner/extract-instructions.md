# Extract verified facts for The Ritz-Carlton, Tysons Corner
Official site confirmed: https://www.ritzcarlton.com/en/hotels/wasty-the-ritz-carlton-tysons-corner/overview/ (chain: ritz-carlton).
Read /home/user/whatahotel-voice/data/research/ritz-carlton-tysons-corner/index.json and the page text in /home/user/whatahotel-voice/data/research/ritz-carlton-tysons-corner/pages/<id>.txt. Use ONLY those pages, never memory. Do not run other commands or fetch anything.
Write /home/user/whatahotel-voice/data/research/ritz-carlton-tysons-corner/facts.json (JSON only) with this shape:
{"facts":[{"id":"r-1","category":"dining","kind":"fact|subjective|unresolved","text":"one atomic statement","doc_id":"p3","excerpt":"copied verbatim from that page, max 240 chars","topic":"short key, e.g. pool-count","as_of":"YYYY-MM-DD or null"}],
 "highlights":["r-4","r-1"],
 "contradictions":[{"topic":"pool-count","note":"p2 says 2 pools, p5 says 3","sources":[{"doc_id":"p2","excerpt":"..."},{"doc_id":"p5","excerpt":"..."}]}]}
## Rules
- Look for: location, design_history, rooms, dining, amenities, family, experiences, practical. Prefer distinctive, property-specific details over generic marketing.
- One fact per entry. The excerpt must be copied exactly from the page; the code rejects any excerpt that is not word for word in the page.
- kind "fact" = stated plainly by the page. kind "subjective" = the hotel's own praise or opinion ("best", "unmatched luxury"): keep it out of facts, label it. kind "unresolved" = unclear or incomplete.
- Never apply a chain-wide amenity or another hotel's feature to this property. Only this property's pages count.
- Never invent distances, travel times, amenities, awards or experiences. A page that does not mention something is not proof it does not exist.
- Awards, renovations, restaurant distinctions, openings: set as_of to the date or year the page gives; if the page gives none, use kind "unresolved".
- If two pages disagree about the same thing, list it under contradictions, still list the facts with the same topic, and the code will hold the disputed ones out.
- highlights: your strongest 5-8 fact ids, most distinctive first. If fewer than 5 verified facts exist, list fewer; do not pad.