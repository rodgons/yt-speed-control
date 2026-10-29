#!/usr/bin/env bash
# Signs YT Speed Control through addons.mozilla.org (unlisted: private, not shown in the store)
# and opens the signed .xpi in Firefox so it can be installed permanently.
#
# Needs AMO API credentials: https://addons.mozilla.org/developers/addon/api/key/
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${WEB_EXT_API_KEY:-}" ]]; then
  read -rp "AMO JWT issuer (API key): " WEB_EXT_API_KEY
fi
if [[ -z "${WEB_EXT_API_SECRET:-}" ]]; then
  read -rsp "AMO JWT secret (hidden): " WEB_EXT_API_SECRET
  echo
fi
export WEB_EXT_API_KEY WEB_EXT_API_SECRET

npx --yes web-ext@8 lint --source-dir extension
npx --yes web-ext@8 sign --source-dir extension --artifacts-dir dist --channel unlisted

xpi=$(ls -t dist/*.xpi | head -1)
echo "Signed: $xpi"
open -a Firefox "$xpi"
echo "Firefox will ask you to confirm adding YT Speed Control."
