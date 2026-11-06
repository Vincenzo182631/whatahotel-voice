# Judge task (one slug)
Read data/verification/work/SLUG/judge-instructions.md and follow it exactly; write data/verification/work/SLUG/findings.json in the format it specifies.
- Judge every claim only against the evidence pages listed there. Never use world knowledge.
- Quotes must be copied character-for-character from the evidence text (no markdown markers like "##", no added or changed words); the import re-checks quotes in code and drops claims whose quote doesn't match.
- Mark a claim supported only if the quote clearly states it; partial if only part is stated (e.g. "all rooms" when only some are); contradicted if the evidence states something incompatible; unsupported if nothing addresses it.
- WhataHotel's own notes (considerations from the WhataHotel page) are not checkable against the official site; follow the instructions for them.
