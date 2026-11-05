# Fact-check loop (one slug)
1. Run: env -u WH_ANTHROPIC_API_KEY NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1 npx tsx src/cli.ts check --hotel SLUG --script-file data/verification/work/SLUG/script.json --verified-only
   It writes the fact-check task (factcheck-instructions.md). Read it and judge the script STRICTLY, turn by turn, as if someone else wrote it.
2. Write data/verification/work/SLUG/factcheck.json as {"passed": true|false, "issues": [{"turn": n, "problem": "..."}]}. passed=true only with zero issues.
3. If there are issues: fix script.json minimally, re-run chk-all.mts (must pass), re-run step 1 and judge the WHOLE script again from scratch. Up to 3 rounds; if it still fails, report FAIL with the issues.
4. Report the number of fixes made.
