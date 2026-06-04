# Handoff — unified-access-auth + projects-control-center

## Obiettivo della sessione
Allineare 2 repo con i remoti GitHub e risolvere il **bug del loop di redirect**: dopo
l'autenticazione l'utente tornava alla dashboard di auth invece di essere portato al
progetto richiesto (link dalla pagina *Projects Control Center*).

## Repo coinvolti
| Repo | Locale | Remote |
|------|--------|--------|
| Auth gateway | `/Volumes/HD_esterno/Progetti/unified-access-auth/` | `dOuReallyDo/unified-access-auth` |
| Control center | `/Volumes/HD_esterno/Progetti/00_CONTROLLO/control-center/` | `dOuReallyDo/projects-control-center` |

Entrambi erano **allineati 0/0** coi remoti prima delle fix.

## Fix completate (commit + push fatti, deploy Vercel auto-triggered)

### 1. Redirect loop (Opzione A — server-authoritative)
Il redirect avveniva solo se presente `returnTo`, ma i link committati non lo avevano e
`apps.redirect_url` non era usato. Soluzione: il server restituisce `redirect_url` dal DB;
`returnTo` resta come override **solo se stesso-origine** (no open redirect).

- `src/app/api/auth/verify-code/route.ts` → aggiunto `redirect_url` nella response (riga 62)
- `src/app/page.tsx` → nuova logica `resolveDestination` / `goToDestination`, `setRedirectUrl`,
  UI step "done" con "Reindirizzamento in corso…"
- `src/app/api/passkeys/authenticate/verify/route.ts` → **nessuna modifica**
  (già ritorna `session.app.redirect_url`)
- control-center `index.html` → **ripristinato** allo stato committato
  (link `https://unified-access-auth-woad.vercel.app/login?app=X`)

### 2. Bug OTP (regex Zod)
Il generatore (`src/lib/crypto.ts` → `randomCode()`) usa l'alfabeto `…23456789` (include `9`),
ma il validatore rifiutava il `9` → ~17% dei codici scartati.

- `src/app/api/auth/verify-code/route.ts` riga 13: regex `[A-Z2-8]` → **`[A-Z2-9]`**
- Commit `28ac48d` ("fix(auth): accept digit 9 in OTP validation to match generator alphabet"),
  push `639a363..28ac48d`

## Azioni ANCORA DA FARE (lato utente — bloccanti)

### 1. Popolare `apps.redirect_url` su Supabase (SQL Editor)
Senza questo il redirect non funziona:
```sql
update public.apps set redirect_url='https://dealer-sales-support-poc.vercel.app', updated_at=now() where slug='dealer-support';
update public.apps set redirect_url='https://pdv.mailittlexp.org',                updated_at=now() where slug='pdv';
update public.apps set redirect_url='https://cbmkt.mailittlexp.org',              updated_at=now() where slug='cbmkt';
update public.apps set redirect_url='https://coverage.mailittlexp.org',           updated_at=now() where slug='coverage';
update public.apps set redirect_url='https://vtop.mailittlexp.org',               updated_at=now() where slug='vtop';
update public.apps set redirect_url='https://bollette-lucew-3.vercel.app',        updated_at=now() where slug='bollette';
```

### 2. Cloudflare Zero Trust (Access) per cbmkt e vtop
`cbmkt.mailittlexp.org` e `vtop.mailittlexp.org` hanno un **secondo gate di login**
(fuori dallo scope dei repo). `one.dash.cloudflare.com` → Access → Applications →
per ciascuna: **Delete** (consigliato) oppure policy **Bypass/Everyone**.
⚠️ Rimuovere il gate rende le app raggiungibili senza auth (come le altre 4).

## Note tecniche per chi continua

- **gh multi-account:** l'account attivo è `morphblue-dou` (NON ha permessi push su `dOuReallyDo`).
  Per pushare:
  ```
  gh auth switch -u dOuReallyDo
  git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin main
  gh auth switch -u morphblue-dou   # ripristina lo stato originale
  ```
- **Vercel team** = `morphbluedou` (≠ org GitHub `dOuReallyDo`). Il Vercel MCP **non** riusciva
  ad accedervi (`list_teams` → vuoto): per gli URL ci si è affidati all'utente.
- **Cookie cross-domain:** non condivisibili tra sottodomini `*.vercel.app` (Public Suffix List).
  L'auth usa cookie host-only `ua_session` + supporto bearer token (`bearerOrCookieToken` in
  `src/lib/http.ts`).

## Verifica suggerita (dopo le 2 azioni utente)
1. Login OTP su `pdv` → deve reindirizzare a `https://pdv.mailittlexp.org`
   (non tornare alla dashboard).
2. `curl -sI https://cbmkt.mailittlexp.org` → non deve più fare 302 verso `cloudflareaccess.com`.
