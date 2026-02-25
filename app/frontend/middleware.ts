/**
 * middleware.ts  (Next.js App Router — runs on Edge Runtime)
 * Gatheraa — Issue #105: Middleware-based auth check + token refresh
 *
 * Responsibilities:
 *  1. Intercept every navigation before the page renders
 *  2. Validate the access token from the cookie
 *  3. Silently refresh the token if expired but refresh token is valid
 *  4. Set auth-state headers so layout/page RSCs can read without re-fetching
 *  5. Redirect unauthenticated / insufficient-role requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { matchRouteRule, isPublicPath, hasRole, UserRole } from './config/route-guard.config';

// ─── Token verification (Edge-compatible, no Node.js crypto) ─────────────────

interface TokenPayload {
  sub: string;
  role: UserRole;
  exp: number;
  iat: number;
}

/**
 * Decode a JWT payload without verifying the signature.
 * Full signature verification is done in the API route / server action.
 * Middleware only needs the expiry + role for routing decisions.
 */
function decodeJwtPayload(token: string): TokenPayload | null {
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return null;
    // Base64url → base64 → decode
    const padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    return JSON.parse(json) as TokenPayload;
  } catch {
    return null;
  }
}

function isExpired(payload: TokenPayload): boolean {
  return Date.now() / 1000 > payload.exp;
}

/**
 * Attempt a silent token refresh via the internal API route.
 * Returns the new access token string, or null on failure.
 */
async function refreshAccessToken(
  refreshToken: string,
  request: NextRequest
): Promise<string | null> {
  try {
    const refreshUrl = new URL('/api/auth/refresh', request.url);
    const res = await fetch(refreshUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward cookies so the refresh endpoint can read the refresh token
        Cookie: `refresh_token=${refreshToken}`,
      },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const { accessToken } = await res.json();
    return accessToken ?? null;
  } catch {
    return null;
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip public paths and static assets immediately
  if (isPublicPath(pathname)) return NextResponse.next();

  const rule = matchRouteRule(pathname);
  if (!rule) return NextResponse.next(); // unguarded route — pass through

  // 2. Read tokens from HttpOnly cookies
  let accessToken = request.cookies.get('access_token')?.value ?? null;
  const refreshToken = request.cookies.get('refresh_token')?.value ?? null;

  let payload: TokenPayload | null = accessToken ? decodeJwtPayload(accessToken) : null;
  let didRefresh = false;

  // 3. Token expired but refresh token exists → silent refresh
  if (payload && isExpired(payload) && refreshToken) {
    const newToken = await refreshAccessToken(refreshToken, request);
    if (newToken) {
      accessToken = newToken;
      payload = decodeJwtPayload(newToken);
      didRefresh = true;
    } else {
      // Refresh failed — treat as unauthenticated
      payload = null;
    }
  }

  const isAuthenticated = !!(payload && !isExpired(payload));
  const userRole: UserRole = payload?.role ?? 'guest';

  // 4. Handle redirectIfAuthed (e.g. /login → /dashboard when already authed)
  if (rule.redirectIfAuthed && isAuthenticated) {
    return NextResponse.redirect(new URL(rule.redirectIfAuthed, request.url));
  }

  // 5. Not authenticated → redirect to login with return URL
  if (!isAuthenticated && rule.requiredRole !== 'guest') {
    const loginUrl = new URL(rule.redirectTo, request.url);
    loginUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 6. Authenticated but insufficient role
  if (isAuthenticated && !hasRole(userRole, rule.requiredRole)) {
    const fallback = rule.insufficientRoleRedirect ?? rule.redirectTo;
    return NextResponse.redirect(new URL(fallback, request.url));
  }

  // 7. Authorized — pass through, attaching auth headers for RSC consumption
  const response = NextResponse.next();

  // Headers are readable in layout.tsx / page.tsx via headers() from next/headers
  response.headers.set('x-auth-user-id', payload?.sub ?? '');
  response.headers.set('x-auth-user-role', userRole);
  response.headers.set('x-auth-authenticated', String(isAuthenticated));
  response.headers.set('x-route-skeleton', rule.skeletonVariant ?? 'generic');

  // 8. If we refreshed the token, set the new cookie on the response
  if (didRefresh && accessToken) {
    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 15, // 15 minutes
      path: '/',
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimization)
     * - favicon.ico
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};