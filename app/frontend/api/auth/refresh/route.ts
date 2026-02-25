/**
 * app/api/auth/refresh/route.ts
 * Gatheraa — Issue #105: Token refresh API endpoint
 *
 * Called by:
 *  - middleware.ts (Edge runtime) for server-side silent refresh
 *  - useAuth hook for client-side refresh
 *
 * Flow:
 *  1. Read refresh token from HttpOnly cookie
 *  2. Validate with auth backend (Stellar wallet session / JWT provider)
 *  3. Issue new access token + rotate refresh token
 *  4. Set new cookies on response
 */

import { NextRequest, NextResponse } from 'next/server';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? 'http://localhost:4000';
const ACCESS_TOKEN_TTL = 60 * 15;        // 15 minutes
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 7; // 7 days

export async function POST(request: NextRequest) {
  // Read refresh token — prefer HttpOnly cookie, fallback to body
  const refreshToken =
    request.cookies.get('refresh_token')?.value ??
    (await request.json().catch(() => ({}))).refreshToken;

  if (!refreshToken) {
    return NextResponse.json(
      { error: 'No refresh token provided' },
      { status: 401 }
    );
  }

  try {
    // ── Call the auth service to validate & rotate the refresh token ─────────
    const upstreamRes = await fetch(`${AUTH_SERVICE_URL}/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!upstreamRes.ok) {
      const response = NextResponse.json(
        { error: 'Token refresh failed' },
        { status: 401 }
      );
      // Clear invalid tokens
      response.cookies.delete('access_token');
      response.cookies.delete('refresh_token');
      return response;
    }

    const { accessToken, refreshToken: newRefreshToken, user } = await upstreamRes.json();

    // ── Build response with new tokens set as HttpOnly cookies ───────────────
    const response = NextResponse.json({ accessToken, user }, { status: 200 });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };

    response.cookies.set('access_token', accessToken, {
      ...cookieOptions,
      maxAge: ACCESS_TOKEN_TTL,
    });

    // Rotate refresh token (prevents token replay)
    if (newRefreshToken) {
      response.cookies.set('refresh_token', newRefreshToken, {
        ...cookieOptions,
        maxAge: REFRESH_TOKEN_TTL,
      });
    }

    return response;
  } catch (error) {
    console.error('[auth/refresh] Upstream error:', error);
    return NextResponse.json(
      { error: 'Internal server error during token refresh' },
      { status: 500 }
    );
  }
}