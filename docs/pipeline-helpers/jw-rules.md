# Judge + Write + Fact-check (one agent, one slug)
- NO FEE AMOUNTS / NO DATED ITEMS: never state exact fee, levy, service-charge or resort-fee amounts or percentages, and never mention dates that will expire (seasonal closing dates, one-off events) in the script, title or short_version.
- NO SPA AGE RULES (user request): never say children are not allowed in the spa, that the spa is adults-only, or give a spa minimum age, anywhere in the script, title or short_version. Describe the spa itself instead.
- NO SHUTTLES (user request, 2026-10-20): never mention shuttle service anywhere in the script, title or short_version, whether the hotel has one or not. It is neither a positive nor a negative. If a consideration is about shuttles or transport by shuttle, cite a different consideration in to_know.
Work in /home/user/whatahotel-voice. SLUG is given in your prompt. Always run CLI commands with `env -u WH_ANTHROPIC_API_KEY NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1`.
1. If data/verification/work/SLUG/judge-instructions.md does not exist, run:
   env -u WH_ANTHROPIC_API_KEY NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1 npx tsx src/cli.ts verify --hotel SLUG --prepare
2. Read and follow /tmp/claude-0/-home-user-whatahotel-voice/b9135170-4070-5763-84c0-dc952cf5c9fa/scratchpad/judge-rules.md for SLUG (write findings.json).
3. Run: bash /tmp/claude-0/-home-user-whatahotel-voice/b9135170-4070-5763-84c0-dc952cf5c9fa/scratchpad/post-judge.sh SLUG  — then confirm data/verification/work/SLUG/writer-instructions.md exists (else report FAIL with output).
4. Read writer-instructions.md and follow it exactly, writing script.json there; also read and obey /tmp/claude-0/-home-user-whatahotel-voice/b9135170-4070-5763-84c0-dc952cf5c9fa/scratchpad/writer-rules.md.
5. When the verify passes, do the fact-check loop in /tmp/claude-0/-home-user-whatahotel-voice/b9135170-4070-5763-84c0-dc952cf5c9fa/scratchpad/fcfix-rules.md, judging strictly as if someone else wrote it.
6. Use only official/editorial facts; never use WhataHotel claims that the official site contradicts (any extra notes in your prompt list them).
Final report: one line "SLUG: PASS/FAIL (n fixes)" plus anything a reviewer must know.
