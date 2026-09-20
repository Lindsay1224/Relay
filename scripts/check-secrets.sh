#!/usr/bin/env bash
set -euo pipefail

if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "ERROR: .env is tracked. Remove it from Git and use Secret Manager." >&2
  exit 1
fi

tracked_env_files="$(git ls-files '.env*' | grep -v '^\.env\.example$' || true)"
if [[ -n "$tracked_env_files" ]]; then
  echo "ERROR: secret environment file tracked:" >&2
  echo "$tracked_env_files" >&2
  exit 1
fi

patterns=(
  'AIza[0-9A-Za-z_-]{20,}'
  '-----BEGIN( [A-Z]+)? PRIVATE KEY-----'
)

for pattern in "${patterns[@]}"; do
  if git grep -nE -e "$pattern" -- ':!scripts/check-secrets.sh' ':!.env.example'; then
    echo "ERROR: possible committed secret detected. Move it to Google Cloud Secret Manager." >&2
    exit 1
  fi
done

if grep -A1 -E 'variable: (GOOGLE_OAUTH_CLIENT_ID|GOOGLE_OAUTH_CLIENT_SECRET|FIREBASE_WEB_API_KEY)' apphosting.yaml | grep -qE '^[[:space:]]+value:'; then
  echo "ERROR: credential variable in apphosting.yaml must use secret:, never value:." >&2
  exit 1
fi
