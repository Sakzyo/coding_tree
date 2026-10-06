#!/bin/sh
# Harmless child retains the output pipes and ignores TERM, like a stubborn daemon.
trap '' TERM
/bin/sleep 30 &
printf '%s %s\n' "$$" "$!" > "$1"
if [ "$2" = exit ]; then
  exit 0
fi
wait
