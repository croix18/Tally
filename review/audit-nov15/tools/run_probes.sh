#!/bin/bash
# run_probes.sh <auditor> [repo]   -> runs every probe of an auditor against a repo copy; prints exit codes (1 = defect present)
A=/home/claude/work/audit; who=$1; repo=${2:-$A/base}
for f in $A/$who/probes/*.js; do [ -f "$f" ] || continue; TALLY_REPO=$repo timeout 300 node "$f" > /tmp/probe.out 2>&1; rc=$?; printf "%-3s %s\n" "$rc" "$(basename $f)"; done
