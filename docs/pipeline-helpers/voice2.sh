#!/bin/bash
# usage: voice2.sh <slug-list-file> : voice hotels whose subagent factcheck passed, unless the latest clip already passed
cd /home/user/whatahotel-voice; S=/tmp/claude-0/-home-user-whatahotel-voice/b9135170-4070-5763-84c0-dc952cf5c9fa/scratchpad
for s in $(cat $1); do f=data/verification/work/$s/factcheck.json; [ -f $f ] || continue; grep -q '"passed": *true' $f || continue
  if [ -d output/$s ]; then v=$(ls output/$s | grep -E '^v[0-9]+$' | sed 's/v//' | sort -n | tail -1)
    python3 -c "import json,sys;d=json.load(open('output/$s/v$v/metadata.json'));sys.exit(0 if d['fact_check'].get('passed') and d.get('script_model')=='manual' else 1)" && continue; fi
  echo "$(date +%T) voicing $s"; bash $S/gen-mo.sh $s >/dev/null 2>&1; tail -2 $S/gen-$s.log | head -1; done
