#!/bin/bash
# usage: fin-mo.sh <slug> : import the judge's findings and mark the profile verified
cd /home/user/whatahotel-voice
env -u WH_ANTHROPIC_API_KEY NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1 npx tsx src/cli.ts verify --hotel $1 --import data/verification/work/$1/findings.json --apply
