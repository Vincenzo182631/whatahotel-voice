# Full pipeline for one hotel (profile -> judge -> write -> fact-check)
SLUG and batch file are in your prompt. Work in /home/user/whatahotel-voice.
Step A: read and follow /tmp/claude-0/-home-user-whatahotel-voice/b9135170-4070-5763-84c0-dc952cf5c9fa/scratchpad/profile-rules.md for SLUG.
Step B: then read and follow /tmp/claude-0/-home-user-whatahotel-voice/b9135170-4070-5763-84c0-dc952cf5c9fa/scratchpad/jw-rules.md for SLUG.
If the research has too few readable official pages to reach the minimum verified facts, stop and report FAIL with the reason; never invent facts.
NO NEGATIVE ACCESSIBILITY CLAIMS: never state that a hotel has no accessible rooms / is not accessible (chain FAQ text on this is unreliable). Leave accessibility out.
NO TEMPORARY CLOSURES/RENOVATIONS: never mention a facility being temporarily closed, under renovation, or "newly renovated/opened" (they go stale). Leave them out.
NO "FREE"/"COMPLIMENTARY": never use these words in authored script text, title or short_version (the pipeline closing is exempt).
HYATT CREDIT: the closing's $100 credit comes from the hotel's own WhataHotel perks table; a $200 figure from the Hyatt Centric chain page does not apply. Don't edit offers.json.
MARRIOTT CREDIT: the closing's credit amount must come from the hotel's own WhataHotel perks table (normally $100); a $50 figure from the Marriott Luminous chain page does not apply. Don't edit offers.json.
IHG CREDIT (incl. Six Senses / IHG Destined): the closing's credit amount must come from the hotel's own WhataHotel perks table (normally $100). Any different figure from an IHG/Six Senses chain page does not apply. Don't edit offers.json.
ACCOR CREDIT: the closing's credit amount must come from the hotel's own WhataHotel perks table; any different figure from an Accor/MGallery chain page does not apply. Don't edit offers.json.
ONE&ONLY CREDIT: the closing's credit amount must come from the hotel's own WhataHotel perks table; any different figure from a One&Only/Kerzner chain page does not apply. Don't edit offers.json.
RELAIS CREDIT: the closing's credit amount must come from the hotel's own WhataHotel perks table; any different figure from a Relais & Châteaux page or another WhataHotel program page does not apply. Don't edit offers.json.
Final report: one line "SLUG: PASS/FAIL (n fixes)", then short reviewer notes (WhataHotel claims the official site contradicts, held-out facts).
