#!/usr/bin/env bash
# Set apps.redirect_url for the 4 unverified PCC projects via Supabase PostgREST.
#
# Requires (the values Vercel marks "sensitive" and won't expose via `vercel env pull`):
#   export NEXT_PUBLIC_SUPABASE_URL='https://<ref>.supabase.co'
#   export SUPABASE_SERVICE_ROLE_KEY='<service_role JWT>'
#
# Run:  bash supabase/set-redirect-urls.sh
set -euo pipefail

: "${NEXT_PUBLIC_SUPABASE_URL:?set NEXT_PUBLIC_SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY}"

BASE="${NEXT_PUBLIC_SUPABASE_URL%/}/rest/v1/apps"
AUTH=(-H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")

declare -a ROWS=(
  "cbmkt|https://cbmkt.mailittlexp.org"
  "coverage|https://coverage.mailittlexp.org"
  "vtop|https://vtop.mailittlexp.org"
  "bollette|https://bollette-lucew-3.vercel.app"
)

for row in "${ROWS[@]}"; do
  slug="${row%%|*}"; url="${row##*|}"
  echo "PATCH ${slug} -> ${url}"
  curl -fsS -X PATCH "${BASE}?slug=eq.${slug}" \
    "${AUTH[@]}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{\"redirect_url\":\"${url}\"}" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  ->", d[0]["slug"], d[0]["redirect_url"]) if d else print("  !! no row matched slug")'
done

echo "=== final state (all apps) ==="
curl -fsS "${BASE}?select=slug,redirect_url,is_active&order=slug" "${AUTH[@]}" \
  | python3 -c 'import json,sys
for r in json.load(sys.stdin): print(f"  {r[\"slug\"]:16s} {r.get(\"redirect_url\")!s:45s} active={r.get(\"is_active\")}")'
