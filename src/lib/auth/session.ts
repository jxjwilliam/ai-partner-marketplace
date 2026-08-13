import { cookies } from "next/headers";
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

export async function getSessionUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const found = await findSessionUser(hashToken(token));
  if (!found || found.session.expiresAt < new Date()) return null;
  return found.user;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await deleteSessionRows(hashToken(token));
  }
  await clearSessionCookie();
}
