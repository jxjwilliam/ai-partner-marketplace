import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { User } from "@/lib/types";
import {
  createSessionRow,
  deleteSessionRows,
  findSessionUser,
} from "@/lib/data";
import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/constants";
import { createSessionToken, hashToken } from "@/lib/auth/session-token";

export { createSessionToken, hashToken };

export async function createSession(userId: string): Promise<{ token: string }> {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await createSessionRow({ tokenHash: hashToken(token), userId, expiresAt });
  return { token };
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

function bearerToken(request?: NextRequest): string | null {
  const header = request?.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function resolveSessionToken(token: string): Promise<User | null> {
  if (!token) return null;
  const found = await findSessionUser(hashToken(token));
  if (!found || found.session.expiresAt < new Date()) return null;
  return found.user;
}

/**
 * Resolve the current user. API routes pass their `NextRequest` so the
 * `Authorization: Bearer <token>` header is honored first — that's how
 * localStorage-backed sessions survive cross-origin iframe embedding (third
 * party cookies are blocked there). The httpOnly cookie remains the fallback
 * for SSR / direct browsing.
 */
export async function getSessionUser(
  request?: NextRequest,
): Promise<User | null> {
  const jar = await cookies();
  const token = bearerToken(request) ?? jar.get(SESSION_COOKIE)?.value ?? null;
  return token ? resolveSessionToken(token) : null;
}

export async function destroySession(token?: string | null): Promise<void> {
  const jar = await cookies();
  const target = token ?? jar.get(SESSION_COOKIE)?.value ?? null;
  if (target) {
    await deleteSessionRows(hashToken(target));
  }
  await clearSessionCookie();
}
