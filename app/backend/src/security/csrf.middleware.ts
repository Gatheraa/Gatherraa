import { ForbiddenException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'crypto';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAMES = ['x-csrf-token', 'x-xsrf-token'];
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((cookies, entry) => {
    const [rawName, ...rawValueParts] = entry.trim().split('=');
    if (!rawName) {
      return cookies;
    }

    try {
      cookies[rawName] = decodeURIComponent(rawValueParts.join('='));
    } catch {
      cookies[rawName] = rawValueParts.join('=');
    }
    return cookies;
  }, {});
}

function getHeaderValue(req: Request): string | undefined {
  for (const headerName of CSRF_HEADER_NAMES) {
    const value = req.headers[headerName];
    if (Array.isArray(value)) {
      return value[0];
    }
    if (value) {
      return value;
    }
  }

  return undefined;
}

function tokensMatch(cookieToken: string, headerToken: string): boolean {
  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);

  return cookieBuffer.length === headerBuffer.length && timingSafeEqual(cookieBuffer, headerBuffer);
}

function getCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  };
}

export function csrfDoubleSubmitMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestCookies = (req.cookies ?? {}) as Record<string, string>;
  const cookies = {
    ...parseCookieHeader(req.headers.cookie),
    ...requestCookies,
  };
  const csrfCookie = cookies[CSRF_COOKIE_NAME];

  if (SAFE_METHODS.has(req.method)) {
    if (!csrfCookie) {
      res.cookie(CSRF_COOKIE_NAME, randomBytes(32).toString('hex'), getCookieOptions());
    }

    next();
    return;
  }

  const hasCookieCredentials = Boolean(req.headers.cookie);
  if (!hasCookieCredentials) {
    next();
    return;
  }

  const csrfHeader = getHeaderValue(req);
  if (!csrfCookie || !csrfHeader || !tokensMatch(csrfCookie, csrfHeader)) {
    next(new ForbiddenException('Invalid CSRF token'));
    return;
  }

  next();
}
