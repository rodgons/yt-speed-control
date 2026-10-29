#!/usr/bin/env bash
# Submits YT Speed Control to addons.mozilla.org (listed: public in the store after review).
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
npx --yes web-ext@8 sign --source-dir extension --artifacts-dir dist --channel listed --approval-timeout 0

echo "Submitted. Track the review at https://addons.mozilla.org/developers/addons"
