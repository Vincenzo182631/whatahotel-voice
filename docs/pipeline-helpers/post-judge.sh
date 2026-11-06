#!/bin/bash
# usage: post-judge.sh <slug...> : import findings, then prepare the writer instructions
cd /home/user/whatahotel-voice
S=/tmp/claude-0/-home-user-whatahotel-voice/b9135170-4070-5763-84c0-dc952cf5c9fa/scratchpad
for k in "$@"; do
  r=$(bash $S/fin-mo.sh $k 2>&1 | tail -2 | tr '\n' ' ' | cut -c1-200)
  p=$(env -u WH_ANTHROPIC_API_KEY NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1 npx tsx src/cli.ts script --hotel $k --prepare --verified-only 2>&1 | grep -E "✓|✗" | head -1 | cut -c1-120)
  echo "$k | $r | $p"
done
