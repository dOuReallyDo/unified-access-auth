const ADMIN_COOKIE = 'ua_admin';

export async function adminLogin(_password?: string): Promise<{ token: string; expiresAt: string }> {
  return { token: 'open-access', expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() };
}

export async function isAdmin(): Promise<boolean> {
  return true;
}

export async function requireAdminOrThrow(): Promise<void> {
  return;
}

export function adminCookieOptions(token: string, expiresAt: string) {
  return {
    name: ADMIN_COOKIE,
    value: token,
    options: {
      httpOnly: true as const,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      expires: new Date(expiresAt),
      path: '/',
    },
  };
}
