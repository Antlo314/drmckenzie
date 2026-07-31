#!/usr/bin/env bash
# Capture per-section screenshots of the local site with headless Chrome.
# Uses ?static=1&only=<id> so no scrolling is needed (deterministic in headless).
# usage: ./shots.sh [section ...]     (default: all)
OUT='C:\Users\aarons\AppData\Local\Temp\claude\C--Users-aarons-Desktop-Dr-Mckenzie\c688a996-2b56-4a51-b69a-3e747dcd4c0e\scratchpad\shots'
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
URL="http://localhost:4980"
H="${H:-1200}"
SECTIONS=("$@")
[ ${#SECTIONS[@]} -eq 0 ] && SECTIONS=(hero about coaching mym books shop missions connect)
for s in "${SECTIONS[@]}"; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --enable-unsafe-swiftshader \
    --screenshot="$OUT\\sec_$s.png" --window-size=1440,$H --virtual-time-budget=8000 \
    "$URL/?static=1&only=$s" >/dev/null 2>&1
  echo "captured $s"
done
