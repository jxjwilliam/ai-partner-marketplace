import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      update: mocks.userUpdate,
    },
  },
}));

import { GET, PATCH } from "@/app/api/me/route";

const sessionUser = {
  id: "user-1",
  phone: "13800138000",
  nickname: "小明",
  city: "上海",
  roleTag: "talent",
  bio: "全栈工程师",
  isAdmin: false,
  createdAt: new Date("2026-01-01"),
};

function patchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/me", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessionUser.mockResolvedValue(sessionUser);
  mocks.userUpdate.mockResolvedValue(sessionUser);
});

describe("GET /api/me", () => {
  it("returns only safe profile fields", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      user: {
        id: "user-1",
        phone: "13800138000",
        nickname: "小明",
        city: "上海",
        roleTag: "talent",
        bio: "全栈工程师",
        isAdmin: false,
      },
    });
  });

  it("rejects an anonymous request", async () => {
    mocks.getSessionUser.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false });
  });
});

describe("PATCH /api/me", () => {
  it("trims and saves a valid onboarding profile", async () => {
    const response = await PATCH(
      patchRequest({
        nickname: "  新用户  ",
        city: "杭州",
        roleTag: "founder",
        bio: "  正在寻找技术合伙人  ",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        nickname: "新用户",
        city: "杭州",
        roleTag: "founder",
        bio: "正在寻找技术合伙人",
      },
    });
  });

  it("rejects invalid cities and roles without updating", async () => {
    const response = await PATCH(
      patchRequest({
        nickname: "新用户",
        city: "火星",
        roleTag: "administrator",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });
});
