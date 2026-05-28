# Client Integration Guide

## Env per ogni app protetta

```env
AUTH_BASE_URL=https://auth.example.com
AUTH_APP_SLUG=bollette
AUTH_SHARED_SECRET=<future-shared-secret-if-needed>
```

## Flow consigliato Next.js

1. Middleware intercetta le pagine protette.
2. Chiama `GET ${AUTH_BASE_URL}/api/auth/session?appSlug=${AUTH_APP_SLUG}` inoltrando cookie e/o bearer token.
3. Se `200` e `active=true`, lascia passare.
4. Se `401/403`, redirect a `${AUTH_BASE_URL}/?app=${AUTH_APP_SLUG}&returnTo=${encodeURIComponent(currentUrl)}`.

## Esempio middleware

```ts
import { NextRequest, NextResponse } from "next/server";

const AUTH_BASE_URL = process.env.AUTH_BASE_URL!;
const AUTH_APP_SLUG = process.env.AUTH_APP_SLUG!;

export async function middleware(req: NextRequest) {
  const sessionUrl = new URL("/api/auth/session", AUTH_BASE_URL);
  sessionUrl.searchParams.set("appSlug", AUTH_APP_SLUG);

  const res = await fetch(sessionUrl, {
    headers: {
      cookie: req.headers.get("cookie") || "",
      authorization: req.headers.get("authorization") || "",
    },
    cache: "no-store",
  });

  if (res.ok) return NextResponse.next();

  const loginUrl = new URL("/", AUTH_BASE_URL);
  loginUrl.searchParams.set("app", AUTH_APP_SLUG);
  loginUrl.searchParams.set("returnTo", req.nextUrl.href);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/public).*)"],
};
```

## App escluse
- Leowander
- Leowander Destination

Non integrare queste app senza richiesta esplicita di Trinity.
