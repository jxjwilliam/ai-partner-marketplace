import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  findOrCreateAuthUser: vi.fn(),
  createSession: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createServerSupabase: () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/data", () => ({
  findOrCreateAuthUser: mocks.findOrCreateAuthUser,
}));
vi.mock("@/lib/auth/session", () => ({
  createSession: mocks.createSession,
  setSessionCookie: mocks.setSessionCookie,
}));

import { POST } from "@/app/api/auth/supabase-session/route";

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/supabase-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const confirmedAuthUser = {
  id: "auth-user-1",
  email: "demo@example.com",
  email_confirmed_at: "2026-08-18T00:00:00Z",
};

const localUser = {
  id: "user-1",
  phone: null,
  authUserId: "auth-user-1",
  email: "demo@example.com",
  nickname: null,
  city: null,
  roleTag: null,
  bio: null,
  skills: [],
  yearsExperience: null,
  isVerified: false,
  isAdmin: false,
  createdAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: confirmedAuthUser }, error: null });
  mocks.findOrCreateAuthUser.mockResolvedValue(localUser);
  mocks.createSession.mockResolvedValue({ token: "session-token" });
  mocks.setSessionCookie.mockResolvedValue(undefined);
});

describe("POST /api/auth/supabase-session", () => {
  it("returns a Chinese 400 response for malformed JSON", async () => {
    const request = new NextRequest(
      "http://localhost/api/auth/supabase-session",
      { method: "POST", body: "{" },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "请求格式错误",
    });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("returns a Chinese 400 response for a null JSON body", async () => {
    const response = await POST(jsonRequest(null));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "请求格式错误",
    });
  });

  it("rejects a missing access token without calling Supabase", async () => {
    const response = await POST(jsonRequest({}));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "登录已失效，请重新获取登录链接",
    });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("rejects an invalid token with a Chinese error", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("bad") });

    const response = await POST(
      jsonRequest({ accessToken: "expired-token" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "登录已失效，请重新获取登录链接",
    });
    expect(mocks.findOrCreateAuthUser).not.toHaveBeenCalled();
  });

  it("rejects an unconfirmed email", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { ...confirmedAuthUser, email_confirmed_at: null } },
      error: null,
    });

    const response = await POST(
      jsonRequest({ accessToken: "valid-token" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "邮箱尚未验证，请重新获取登录链接",
    });
    expect(mocks.findOrCreateAuthUser).not.toHaveBeenCalled();
  });

  it("normalizes the email and mints an app session for a new user", async () => {
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "auth-user-1",
          email: "Demo.User@Example.com",
          email_confirmed_at: "2026-08-18T00:00:00Z",
        },
      },
      error: null,
    });

    const response = await POST(
      jsonRequest({ accessToken: "valid-token" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      token: "session-token",
      needsOnboarding: true,
    });
    expect(mocks.findOrCreateAuthUser).toHaveBeenCalledWith({
      authUserId: "auth-user-1",
      email: "demo.user@example.com",
    });
    expect(mocks.createSession).toHaveBeenCalledWith("user-1");
    expect(mocks.setSessionCookie).toHaveBeenCalledWith("session-token");
  });

  it("skips onboarding for users who completed their profile", async () => {
    mocks.findOrCreateAuthUser.mockResolvedValue({
      ...localUser,
      nickname: "小明",
      city: "上海",
      roleTag: "talent",
    });

    const response = await POST(
      jsonRequest({ accessToken: "valid-token" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      token: "session-token",
      needsOnboarding: false,
    });
  });
});
