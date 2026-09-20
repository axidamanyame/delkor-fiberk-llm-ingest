#!/bin/sh
cd "$(dirname "$0")"
echo
echo "  Delkor-Fiberk ERP  (local)"
echo "  http://127.0.0.1:5500/login.html"
echo "  Leave this window open. Sign in with your HQ account."
echo
if command -v node >/dev/null 2>&1; then
  (sleep 1; command -v open >/dev/null && open "http://127.0.0.1:5500/login.html"; command -v xdg-open >/dev/null && xdg-open "http://127.0.0.1:5500/login.html") >/dev/null 2>&1 &
  exec node start-local.mjs
fi
if command -v python3 >/dev/null 2>&1; then
  (sleep 1; command -v open >/dev/null && open "http://127.0.0.1:5500/login.html") >/dev/null 2>&1 &
  exec python3 -m http.server 5500 --bind 127.0.0.1
fi
echo "  Need Node.js (https://nodejs.org) or Python 3, then run this file again."
exit 1
