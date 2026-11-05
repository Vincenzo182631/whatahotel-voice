#!/bin/bash
# usage: api-watch.sh <results-file> <done-file> : run api-run.sh on each new "slug: PASS" line; stop after 20 idle minutes
S=/tmp/claude-0/-home-user-whatahotel-voice/b9135170-4070-5763-84c0-dc952cf5c9fa/scratchpad
R=$1; D=$2; touch $D; idle=0
while [ $idle -lt 40 ]; do
  new=$(grep -oE "^[a-z0-9-]+: PASS" $R 2>/dev/null | cut -d: -f1 | sort -u | grep -vxF -f $D)
  if [ -z "$new" ]; then idle=$((idle+1)); sleep 30; continue; fi
  idle=0; for k in $new; do echo $k >> $D; bash $S/api-run.sh $k; done
done
echo WATCH-END
