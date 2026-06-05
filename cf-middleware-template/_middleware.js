/**
 * Cloudflare Pages Function — _middleware.js
 *
 * Protects a project domain behind UAA authentication.
 * - If no session cookie → redirect to UAA login with app slug
 * - If ua_token in URL (coming from UAA redirect) → validate & set cookie
 * - If cookie exists → validate & allow through
 *
 * Place in: functions/_middleware.js (in the project's deploy root)
 *
 * Config per project:
 *   UA_APP_SLUG  — the app slug registered in UAA (e.g. "cbmkt", "vtop")
 *   UA_ORIGIN    — UAA base URL (e.g. "https://unified-access-auth-woad.vercel.app")
 */

const UA_ORIGIN = 'https://unified-access-auth-woad.vercel.app';
const COOKIE_NAME = 'ua_session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

// Paths that never require auth (static assets, favicon, etc.)
const PUBLIC_PATHS = ['/favicon.ico', '/robots.txt', '/_next/', '/_static/', '/assets/'];

function isPublicPath(path) {
  return PUBLIC_PATHS.some(p => path.startsWith(p));
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Skip auth for static assets
  if (isPublicPath(path)) return next();

  // Read UA_APP_SLUG from environment (set in CF Pages settings)
  const APP_SLUG = context.env.UA_APP_SLUG || 'unknown';

  // --- STEP 1: Handle ua_token from UAA redirect ---
  const uaToken = url.searchParams.get('ua_token');
  if (uaToken) {
    // Validate the token with UAA
    try {
      const validateRes = await fetch(`${UA_ORIGIN}/api/auth/validate?app=${APP_SLUG}`, {
        headers: { Authorization: `Bearer ${uaToken}` }
      });
      if (validateRes.ok) {
        const data = await validateRes.json();
        if (data.ok) {
          // Token is valid — set cookie and redirect to clean URL
          const cleanUrl = new URL(url.pathname, url.origin);
          // Preserve returnTo if present
          const returnTo = url.searchParams.get('returnTo');
          if (returnTo) cleanUrl.searchParams.set('returnTo', returnTo);

          const response = Response.redirect(cleanUrl.toString(), 302);
          response.headers.append('Set-Cookie', `${COOKIE_NAME}=${uaToken}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`);
          return response;
        }
      }
    } catch (e) {
      console.error('UAA validation error:', e);
    }
    // Token invalid — redirect to UAA for fresh login
    const loginUrl = new URL('/', UA_ORIGIN);
    loginUrl.searchParams.set('app', APP_SLUG);
    loginUrl.searchParams.set('returnTo', url.origin + url.pathname);
    return Response.redirect(loginUrl.toString(), 302);
  }

  // --- STEP 2: Check existing cookie ---
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (match) {
    const token = match[1];
    // Validate token with UAA
    try {
      const validateRes = await fetch(`${UA_ORIGIN}/api/auth/validate?app=${APP_SLUG}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (validateRes.ok) {
        const data = await validateRes.json();
        if (data.ok) {
          // Valid session — allow through
          return next();
        }
      }
      // Invalid/expired cookie — clear it and redirect to login
      const response = Response.redirect(
        `${UA_ORIGIN}/?app=${APP_SLUG}&returnTo=${encodeURIComponent(url.origin + url.pathname)}`,
        302
      );
      response.headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
      return response;
    } catch (e) {
      console.error('UAA validation error:', e);
      // Network error contacting UAA — allow through to avoid blocking all access
      return next();
    }
  }

  // --- STEP 3: No cookie, no token — redirect to UAA login ---
  const loginUrl = new URL('/', UA_ORIGIN);
  loginUrl.searchParams.set('app', APP_SLUG);
  loginUrl.searchParams.set('returnTo', url.origin + url.pathname);
  return Response.redirect(loginUrl.toString(), 302);
}