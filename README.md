# Unified Access Auth

Next.js app for common authentication across multiple internal apps.

## Features
- Supabase schema for apps, users, app access, OTP codes, trusted devices, passkey credentials and audit logs.
- Email OTP request/verify via Resend.
- Session validation and logout APIs backed by `trusted_devices` session hashes.
- Minimal admin dashboard for apps, users, access grants, passkeys and audit logs.
- WebAuthn/passkey routes using `@simplewebauthn`.

## Setup
1. Create a Supabase project and run `supabase/schema.sql`.
2. Copy `.env.example` to `.env.local` and fill values.
3. Install and run:

```bash
npm install
npm run dev
```

## API
- `POST /api/auth/request-code` `{ "email": "user@example.com", "appSlug": "dealer-support" }`
- `POST /api/auth/verify-code` `{ "email": "user@example.com", "appSlug": "dealer-support", "code": "123456", "deviceName": "iPhone" }`
- `GET /api/auth/session?appSlug=dealer-support` with cookie or `Authorization: Bearer <token>`
- `POST /api/auth/logout` with cookie or bearer token
- Passkeys:
  - `POST /api/passkeys/register/options`
  - `POST /api/passkeys/register/verify`
  - `POST /api/passkeys/authenticate/options`
  - `POST /api/passkeys/authenticate/verify`

## Admin
Open `/admin`. Mutations require `ADMIN_API_KEY` in server environment and current forms include it as a plain field for this scaffold only. Replace with a real admin session before production.

## Security notes
- Never expose `SUPABASE_SERVICE_ROLE_KEY` client-side.
- OTP codes and session tokens are stored only as SHA-256 hashes.
- `trusted_devices` doubles as the minimal session store to keep the requested schema compact.


## Exclusions
Leowander and Leowander Destination are excluded from this rollout unless explicitly requested by Trinity.
