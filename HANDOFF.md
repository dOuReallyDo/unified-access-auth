# Handoff — unified-access-auth + projects-control-center

_Ultimo aggiornamento: 2026-06-04_

## Obiettivo
Risolvere il **loop di redirect**: dopo l'autenticazione (link dalla pagina *Projects
Control Center*, PCC) l'utente tornava alla dashboard di auth invece di essere portato
al progetto richiesto. + cablare l'**auto-deploy** GitHub → Vercel.

## Repo coinvolti
| Repo | Locale | Remote |
|------|--------|--------|
| Auth gateway | `/Volumes/HD_esterno/Progetti/unified-access-auth/` | `dOuReallyDo/unified-access-auth` |
| Control center | `/Volumes/HD_esterno/Progetti/00_CONTROLLO/control-center/` | `dOuReallyDo/projects-control-center` |

## Stato attuale (cosa è FATTO e VERIFICATO)

### 1. Redirect loop — RISOLTO e testato su `pdv`
- **Vera causa**: la fix del redirect era su GitHub `main` ma **non era mai stata deployata**
  → la produzione serviva codice vecchio di ~8h. Non era un bug di codice né del DB.
- Fix di codice (già su `main`):
  - `src/app/api/auth/verify-code/route.ts` → ritorna `app.redirect_url` (ricavato dal DB).
  - `src/app/page.tsx` → `resolveDestination`/`goToDestination`: usa `apps.redirect_url`;
    `returnTo` onorato **solo se same-origin** (no open redirect); step UI "done" con redirect.
- **Verifica end-to-end OK su `pdv`**: login OTP reale → atterrato su `https://pdv.mailittlexp.org`.
  `apps.redirect_url` per `pdv` confermato popolato.

### 2. Bug OTP (regex Zod) — RISOLTO
Il generatore (`src/lib/crypto.ts` → `randomCode()`) usa l'alfabeto `…23456789` (include `9`),
ma il validatore rifiutava il `9` (~17% codici scartati).
- `src/app/api/auth/verify-code/route.ts`: regex `[A-Z2-8]` → **`[A-Z2-9]`** (commit `28ac48d`).

### 3. Auto-deploy GitHub → Vercel — CABLATO e testato (questa sessione)
**Integrazione nativa NON usabile**: il team Vercel `morphbluedou` è agganciato all'identità
GitHub `morphblue-dou`, ma il repo è di `dOuReallyDo` (account personale diverso). Le install
della Vercel GitHub App su account personali non sono cross-visibili → `vercel git connect`
fallisce e il progetto resta `link: null`.

**Soluzione adottata: GitHub Actions** (commit `ed8f769`):
- `.github/workflows/deploy.yml` — trigger su push a `main` (+ `workflow_dispatch`).
  Fa `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`.
- `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` sono hard-coded nel workflow (non sono segreti).
- Secret repo **`VERCEL_TOKEN`** (impostato dall'utente come `dOuReallyDo`).
- **Verificato**: prima run verde (1m8s), nuovo deployment `READY` in produzione,
  alias `unified-access-auth-woad.vercel.app` → 200.
- **Da ora ogni push su `main` deploya in produzione da solo** (niente più `vercel --prod` a mano).
- ⚠️ Nota: ogni push su `main`, anche solo di docs, fa partire un deploy in produzione.

## Azioni ANCORA DA FARE

### 1. Verificare `redirect_url` per gli altri 5 progetti PCC
Solo `pdv` è confermato. Da verificare: `coverage`, `bollette`, `dealer-support`, `cbmkt`, `vtop`.
SQL di riferimento (Supabase SQL Editor):
```sql
update public.apps set redirect_url='https://dealer-sales-support-poc.vercel.app', updated_at=now() where slug='dealer-support';
update public.apps set redirect_url='https://pdv.mailittlexp.org',                updated_at=now() where slug='pdv';
update public.apps set redirect_url='https://cbmkt.mailittlexp.org',              updated_at=now() where slug='cbmkt';
update public.apps set redirect_url='https://coverage.mailittlexp.org',           updated_at=now() where slug='coverage';
update public.apps set redirect_url='https://vtop.mailittlexp.org',               updated_at=now() where slug='vtop';
update public.apps set redirect_url='https://bollette-lucew-3.vercel.app',        updated_at=now() where slug='bollette';
```
Metodo di test: request-code → leggere OTP dalla mail → verify-code → ispezionare `app.redirect_url`.

### 2. Cloudflare Zero Trust (Access) per `cbmkt` e `vtop`
`cbmkt.mailittlexp.org` e `vtop.mailittlexp.org` hanno un **secondo gate di login** (fuori dallo
scope dei repo). `one.dash.cloudflare.com` → Access → Applications → per ciascuna: **Delete**
oppure policy **Bypass/Everyone**. ⚠️ Rimuovere il gate le rende raggiungibili senza auth.

### 3. (Opzionale) Pulizia CI
- Bump `actions/checkout@v4` e `actions/setup-node@v4` → `@v5`: girano su Node 20, deprecato
  dal **2026-06-16** (warning non bloccante).

## Note tecniche per chi continua

- **Email di test (auth)**: `mario.curcio@gmail.com` (NON `doureallydo@gmail.com`).
  OTP inviati da `no-reply@mailittlexp.org`. Display name app: `pdv`="PDV Scraper",
  `dealer-support`="Dealer Sales Support".
- **gh multi-account**: l'account attivo è `morphblue-dou` (NON ha push su `dOuReallyDo`, non è
  collaboratore). Per pushare / scrivere secret sul repo:
  ```
  gh auth switch -u dOuReallyDo
  git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin main
  gh auth switch -u morphblue-dou
  ```
- **Vercel**: progetto `unified-access-auth` (`prj_kTzoKa04UJScXSowOjt4WkGJv5Kv`),
  team `morphbluedou` (`team_NHrTEOxQuKPlnmro2v0gZX7C`), alias prod `unified-access-auth-woad.vercel.app`.
  Token CLI in `~/Library/Application Support/com.vercel.cli/auth.json`. Il Vercel MCP NON ha
  scope su `morphbluedou` (403) → usare CLI o API REST con quel token.
- **Trucco per verificare quale codice è in produzione**: scaricare il bundle
  `/_next/static/chunks/app/page-*.js` e fare `grep redirect_url` (i minifier preservano i nomi
  delle property degli oggetti API). 0 = codice vecchio, >0 = nuovo.
- **Cookie cross-domain**: non condivisibili tra sottodomini `*.vercel.app` (Public Suffix List).
  Auth usa cookie host-only `ua_session` + bearer token (`bearerOrCookieToken` in `src/lib/http.ts`).
- **control-center** `index.html`: link `https://unified-access-auth-woad.vercel.app/login?app=X`
  (senza `returnTo`; `/login` è uno shim che reindirizza a `/?app=X`).

## Commit chiave (origin/main)
- `639a363` redirect fix · `28ac48d` OTP regex `[A-Z2-9]` · `dbda663` handoff · `ed8f769` CI workflow

## Verifica suggerita (dopo le azioni utente)
1. Login OTP su un progetto → deve reindirizzare al dominio del progetto (non alla dashboard UAA).
2. `curl -sI https://cbmkt.mailittlexp.org` → non deve più fare 302 verso `cloudflareaccess.com`.
3. Push qualunque su `main` → run verde in Actions + nuovo deployment `READY` su Vercel.
