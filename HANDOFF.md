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

### 1. Redirect loop — RISOLTO (verificato su `pdv` e `dealer-support`)
- **Vera causa**: la fix del redirect era su GitHub `main` ma **non era mai stata deployata**
  → la produzione serviva codice vecchio di ~8h. Non era un bug di codice né del DB.
- Fix di codice (già su `main`):
  - `src/app/api/auth/verify-code/route.ts` → ritorna `app.redirect_url` (ricavato dal DB).
  - `src/app/page.tsx` → `resolveDestination`/`goToDestination`: usa `apps.redirect_url`;
    `returnTo` onorato **solo se same-origin** (no open redirect); step UI "done" con redirect.
- **`redirect_url` verificato** (flusso reale request-code → verify-code):
  - `pdv` → `https://pdv.mailittlexp.org` (login browser completo, atterrato sul progetto)
  - `dealer-support` → `https://dealer-sales-support-poc.vercel.app`

### 2. Bug OTP (regex Zod) — RISOLTO
Il generatore (`src/lib/crypto.ts` → `randomCode()`) usa l'alfabeto `…23456789` (include `9`),
ma il validatore rifiutava il `9` (~17% codici scartati).
- `src/app/api/auth/verify-code/route.ts`: regex `[A-Z2-8]` → **`[A-Z2-9]`** (commit `28ac48d`).

### 3. Auto-deploy GitHub → Vercel — CABLATO e testato
**Integrazione nativa NON usabile**: il team Vercel `morphbluedou` è agganciato all'identità
GitHub `morphblue-dou`, ma il repo è di `dOuReallyDo` (account personale diverso). Le install
della Vercel GitHub App su account personali non sono cross-visibili → `vercel git connect`
fallisce e il progetto resta `link: null`.

**Soluzione adottata: GitHub Actions** (commit `ed8f769`):
- `.github/workflows/deploy.yml` — trigger su push a `main` (+ `workflow_dispatch`).
  Fa `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`.
- `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` hard-coded nel workflow (non sono segreti).
- Secret repo **`VERCEL_TOKEN`** (impostato come `dOuReallyDo`).
- **Verificato**: run verdi, nuovo deployment `READY` in produzione, alias → 200.
- **Da ora ogni push su `main` deploya in produzione da solo**.
- ⚠️ Ogni push su `main`, anche solo di docs, fa partire un deploy in produzione.

### 4. Push senza "gh dance" — FATTO
`morphblue-dou` è stato aggiunto come **collaboratore `write`** del repo → `git push` funziona
diretto come account attivo, senza più `gh auth switch`. Il credential helper **locale** del repo
è impostato su `!gh auth git-credential`.

## Azioni ANCORA DA FARE

### 1. Verificare `redirect_url` per i restanti 4 progetti PCC
Verificati: `pdv`, `dealer-support`. **Da verificare**: `cbmkt`, `coverage`, `vtop`, `bollette`.
Per questi `mario.curcio@gmail.com` **non ha accesso** (request-code → `pending_approval`), quindi
il flusso OTP non è completabile senza prima un'approvazione admin.

**Check autoritativo più rapido** (Supabase SQL Editor):
```sql
select slug, redirect_url, is_active from public.apps order by slug;
```
Valori attesi (da impostare se mancanti):
```sql
update public.apps set redirect_url='https://cbmkt.mailittlexp.org',       updated_at=now() where slug='cbmkt';
update public.apps set redirect_url='https://coverage.mailittlexp.org',     updated_at=now() where slug='coverage';
update public.apps set redirect_url='https://vtop.mailittlexp.org',         updated_at=now() where slug='vtop';
update public.apps set redirect_url='https://bollette-lucew-3.vercel.app',  updated_at=now() where slug='bollette';
```
> Leggere il DB da fuori non è possibile: la service role key è marcata *sensitive* su Vercel (non
> estraibile via `vercel env pull`) e il client non usa Supabase direttamente (tutto via API route).
> Quindi la verifica passa o dal flusso reale (serve accesso) o da una SELECT nel SQL Editor.

**Stato (2026-06-04): BLOCCATO sulla credenziale.** La service role key NON è recuperabile da
questa macchina. Verificato esaustivamente:
- nessun file `.env` (solo `.env.example` vuoto); nessuna var d'ambiente;
- `vercel env pull` restituisce **valori vuoti per TUTTE le var del progetto** (incl.
  `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`): l'account attivo `morphblue-dou` è
  *collaborator*, non può decrittare i secret del progetto — solo le var di sistema Vercel passano;
- nessun token Supabase in keychain / shell history; `supabase` CLI non autenticato;
- nessuna URL `*.supabase.co` né JWT `service_role` nei due repo.

**Per eseguire (serve la key, da chi ha accesso owner su Vercel o al dashboard Supabase):**
- Opzione A — SQL Editor di Supabase: incollare gli `update ...` qui sopra (zero credenziali locali).
- Opzione B — script pronto `supabase/set-redirect-urls.sh` (PATCH via PostgREST):
  ```sh
  export NEXT_PUBLIC_SUPABASE_URL='https://<ref>.supabase.co'
  export SUPABASE_SERVICE_ROLE_KEY='<service_role JWT>'
  bash supabase/set-redirect-urls.sh   # PATCH dei 4 slug + stampa stato finale di tutte le apps
  ```

### 2. Cloudflare Zero Trust (Access) per `cbmkt` e `vtop`
`cbmkt.mailittlexp.org` e `vtop.mailittlexp.org` hanno un **secondo gate di login** (fuori dallo
scope dei repo).

**wrangler NON può gestire Access (Zero Trust)** — verificato: `wrangler` espone solo `tunnel`
(experimental), `wrangler access` → `Unknown argument: access`. Le Access Applications/Policies si
gestiscono solo da **dashboard**, **API REST Cloudflare**, o **Terraform** (`cloudflare_zero_trust_access_application`).

**Account Cloudflare** (da `~/.cloudflared` + `.wrangler/cache/wrangler-account.json`):
`Doureallydo@gmail.com's Account`, id **`fdd8f4a187e661aa958f6d17d8beb286`**. Sulla macchina c'è solo
un *origin cert* di tunnel (`~/.cloudflared/cert.pem`) — **NON** un API token con scope `Access:Edit`,
quindi non utilizzabile per l'API. Serve creare un API token o usare il dashboard.

**Manuale (più rapido)** — `one.dash.cloudflare.com` → **Access → Applications** → per `cbmkt` e
`vtop`: **Delete** l'app, oppure aggiungere/sostituire con una policy **Action: Bypass**, **Include:
Everyone**. ⚠️ Rimuovere il gate le rende raggiungibili senza auth.

**Via API** (se si crea un token con permesso *Access: Apps and Policies = Edit*):
```sh
export CF_API_TOKEN='<token con Access:Edit>'
ACC=fdd8f4a187e661aa958f6d17d8beb286
# 1) trova gli UUID delle app
curl -fsS "https://api.cloudflare.com/client/v4/accounts/$ACC/access/apps" \
  -H "Authorization: Bearer $CF_API_TOKEN" | python3 -m json.tool   # cerca i domini cbmkt/vtop
# 2a) rimuovere del tutto il gate:  DELETE .../access/apps/<APP_UUID>
# 2b) oppure policy Bypass/Everyone:
curl -fsS -X POST "https://api.cloudflare.com/client/v4/accounts/$ACC/access/apps/<APP_UUID>/policies" \
  -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Bypass all","decision":"bypass","include":[{"everyone":{}}]}'
```
Verifica: `curl -sI https://cbmkt.mailittlexp.org` → niente più 302 verso `*.cloudflareaccess.com`.

### 3. (Opzionale) Pulizia CI — FATTO
- Bump `actions/checkout@v4` → `@v5` e `actions/setup-node@v4` → `@v5` in `.github/workflows/deploy.yml`.
  (`node-version: 20` invariato.) Risolve il warning di deprecazione Node 20 del **2026-06-16**.

## Note tecniche per chi continua

- **Email di test (auth)**: `mario.curcio@gmail.com` (NON `doureallydo@gmail.com`).
  OTP inviati da `no-reply@mailittlexp.org`, subject `Your access code for <AppName>`.
  Display name app: `pdv`="PDV Scraper", `dealer-support`="Dealer Sales Support", `vtop`="VTOP".
- **gh multi-account**: l'account attivo è `morphblue-dou`, ora **collaboratore `write`** del repo
  → `git push` diretto, **senza dance**. Le operazioni **admin** (gestire i *secret* Actions,
  aggiungere collaboratori) richiedono ancora `dOuReallyDo`:
  ```
  gh auth switch -u dOuReallyDo     # solo per operazioni admin (es. ruotare VERCEL_TOKEN)
  # ... operazione ...
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
- `639a363` redirect fix · `28ac48d` OTP regex `[A-Z2-9]` · `ed8f769` CI workflow · + update handoff

## Verifica suggerita
1. Login OTP su un progetto → deve reindirizzare al dominio del progetto (non alla dashboard UAA).
2. `curl -sI https://cbmkt.mailittlexp.org` → non deve più fare 302 verso `cloudflareaccess.com`.
3. Push qualunque su `main` → run verde in Actions + nuovo deployment `READY` su Vercel.
