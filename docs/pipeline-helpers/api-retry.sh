#!/bin/bash
# usage: api-retry.sh <slug-file> : regenerate (API script+factcheck+voice) hotels whose latest version failed fact-check, up to 2 tries
cd /home/user/whatahotel-voice; S=/tmp/claude-0/-home-user-whatahotel-voice/b9135170-4070-5763-84c0-dc952cf5c9fa/scratchpad
latest(){ ls output/$1 | grep -E '^v[0-9]+$' | sed 's/v//' | sort -n | tail -1; }
passed(){ python3 -c "import json,sys;d=json.load(open('output/$1/v$(latest $1)/metadata.json'));fc=d['fact_check'];sys.exit(0 if (fc.get('passed') if isinstance(fc,dict) else fc) and 75<=d['duration_seconds']<=100 else 1)"; }
for try in 1 2; do for k in $(cat $1); do passed $k && continue; echo "== $k try $try $(date +%T)"
  env -u ELEVENLABS_VOICE_ADVISOR -u ELEVENLABS_VOICE_TRAVELER NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1 npx tsx src/cli.ts generate --hotel $k --provider elevenlabs --verified-only > $S/apig-$k-r$try.log 2>&1; grep -E "✓ v|✗" $S/apig-$k-r$try.log | head -2; done; done
for k in $(cat $1); do passed $k && echo "PASS $k v$(latest $k)" || echo "FAIL $k"; done
