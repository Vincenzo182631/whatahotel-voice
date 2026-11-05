#!/bin/bash
# usage: res-chunk.sh <slug-list-file> [extra research flags]
cd /home/user/whatahotel-voice; f=$1; shift
for s in $(cat $f); do echo "== $s"; env -u WH_ANTHROPIC_API_KEY NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1 WH_FIRECRAWL_GAP_MS=4000 timeout 400 npx tsx src/cli.ts research --hotel $s --with-editorial --max-pages 12 --max-fc-calls 16 "$@" 2>&1 | grep -v "^$" | head -5; done
