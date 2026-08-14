/**
 * Browser-side session storage for iframe-safe auth.
 *
 * Third-party cookies are blocked inside the dashboard iframe, so the session
 * token is persisted in localStorage (origin-scoped) and sent to API routes as
 * `Authorization: Bearer <token>`. The server still sets an httpOnly cookie
 * for direct browsing; `getSessionUser(request)` honors the header first and
 * falls back to the cookie.
 */

const STORAGE_KEY = "aim_session_token";

export function getClientToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setClientToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearClientToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** fetch() that attaches the localStorage session token when present. */
export function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = getClientToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers, credentials: "same-origin" });
}
