#!/bin/bash
cd /home/user/whatahotel-voice
S=/tmp/claude-0/-home-user-whatahotel-voice/b9135170-4070-5763-84c0-dc952cf5c9fa/scratchpad
k=$1; w=data/verification/work/$k
env -u ELEVENLABS_VOICE_ADVISOR -u ELEVENLABS_VOICE_TRAVELER -u WH_ANTHROPIC_API_KEY -u ANTHROPIC_API_KEY NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1 npx tsx src/cli.ts generate --hotel $k --provider elevenlabs --script-file $w/script.json --factcheck-file $w/factcheck.json --verified-only > $S/gen-$k.log 2>&1
