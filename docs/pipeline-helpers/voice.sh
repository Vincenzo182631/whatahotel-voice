#!/bin/bash
# usage: voice.sh <slug-list-file> : voice hotels whose factcheck passed and that have no output dir
cd /home/user/whatahotel-voice; S=/tmp/claude-0/-home-user-whatahotel-voice/b9135170-4070-5763-84c0-dc952cf5c9fa/scratchpad
for s in $(cat $1); do f=data/verification/work/$s/factcheck.json; [ -f $f ] || continue; grep -q '"passed": *true' $f || continue; [ -d output/$s ] && continue; echo "$(date +%T) voicing $s"; bash $S/gen-mo.sh $s >/dev/null 2>&1; tail -2 $S/gen-$s.log | head -1; done
