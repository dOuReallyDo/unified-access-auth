import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { bearerOrCookieToken, jsonError } from '@/lib/http';

/**
 * GET /api/auth/validate?app=<slug>
 *
 * Validates a session token and checks access to a specific app.
 * Used by CF Pages _middleware to verify tokens on project domains.
 *
 * Headers:
 *   Authorization: Bearer <token>  OR  Cookie: ua_session=<token>
 *
 * Query params:
 *   app — app slug (e.g. "cbmkt", "vtop")
 *
 * Returns:
 *   200 { ok: true, user: { id, email }, app: { id, slug, name }, role: "user"|"admin" }
 *   401 { ok: false, error: "Unauthorized" }
 *   403 { ok: false, error: "No access to this app" }
 */
export async function GET(req: NextRequest) {
  const appSlug = req.nextUrl.searchParams.get('app');
  if (!appSlug) return jsonError('Missing app parameter', 400);

  let token: string | null = null;

  // 1. Check Authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // 2. Check query param ua_token (for CF middleware redirects)
  if (!token) {
    token = req.nextUrl.searchParams.get('ua_token');
  }

  // 3. Check cookie (same-origin requests)
  if (!token) {
    const cookie = req.cookies.get('ua_session');
    if (cookie) token = cookie.value;
  }

  if (!token) return jsonError('Unauthorized — no token provided', 401);

  const session = await validateSession(token, appSlug);
  if (!session) return jsonError('Invalid or expired session', 401);

  const user = session.users as unknown as { id: string; email: string; display_name: string | null };
  const app = session.apps as unknown as { id: string; slug: string; name: string; redirect_url: string | null };

  // Check app-specific access
  const { userHasAccess } = await import('@/lib/auth');
  const access = await userHasAccess(user.id, app.id);
  if (!access) return jsonError('No access to this app', 403);

  // Update last_seen
  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, display_name: user.display_name },
    app: { id: app.id, slug: app.slug, name: app.name, redirect_url: app.redirect_url },
    role: access.role
  });
}