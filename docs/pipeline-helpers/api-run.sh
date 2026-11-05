#!/bin/bash
# usage: api-run.sh <slug...> : API judge (verify --apply) then API script+factcheck+voice (generate --verified-only)
cd /home/user/whatahotel-voice
S=/tmp/claude-0/-home-user-whatahotel-voice/b9135170-4070-5763-84c0-dc952cf5c9fa/scratchpad
for k in "$@"; do
  echo "== $k $(date +%T)"
  NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1 npx tsx src/cli.ts verify --hotel $k --apply > $S/apiv-$k.log 2>&1; tail -2 $S/apiv-$k.log
  env -u ELEVENLABS_VOICE_ADVISOR -u ELEVENLABS_VOICE_TRAVELER NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1 npx tsx src/cli.ts generate --hotel $k --provider elevenlabs --verified-only > $S/apig-$k.log 2>&1; tail -2 $S/apig-$k.log
done
