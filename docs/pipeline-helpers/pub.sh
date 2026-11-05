#!/bin/bash
# usage: pub.sh <slug-list-file> : approve + publish the latest version
cd /home/user/whatahotel-voice
URL=https://mgybenoop5mbek0c.public.blob.vercel-storage.com/wah-take.js
for k in $(cat $1); do
  v=$(ls output/$k | grep -E '^v[0-9]+$' | sed 's/v//' | sort -n | tail -1)
  E="env -u WH_ANTHROPIC_API_KEY NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1"
  a=$($E npx tsx src/cli.ts review --hotel $k --version $v --approve 2>&1 | tail -1 | cut -c1-120)
  p=$($E npx tsx src/cli.ts publish --hotel $k --version $v --script-url $URL 2>&1 | tail -2 | tr '\n' ' ' | cut -c1-160)
  echo "$k v$v | $a | $p"
done
