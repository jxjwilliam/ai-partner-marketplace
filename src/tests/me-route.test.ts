import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  updateUserProfile: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/lib/data", () => ({
  updateUserProfile: mocks.updateUserProfile,
}));

import { GET, PATCH } from "@/app/api/me/route";

const sessionUser = {
  id: "user-1",
  phone: "13800138000",
  nickname: "小明",
  city: "上海",
  roleTag: "talent",
  bio: "全栈工程师",
  skills: ["全栈", "AI大模型"],
  yearsExperience: 12,
  isVerified: false,
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
  mocks.updateUserProfile.mockResolvedValue(sessionUser);
});

describe("GET /api/me", () => {
  it("requires a session", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns the safe user payload", async () => {
    const response = await GET();
    await expect(response.json()).resolves.toEqual({
      ok: true,
      user: {
        id: "user-1",
        phone: "13800138000",
        nickname: "小明",
        city: "上海",
        roleTag: "talent",
        bio: "全栈工程师",
        skills: ["全栈", "AI大模型"],
        yearsExperience: 12,
        isVerified: false,
        isAdmin: false,
      },
    });
  });
});

describe("PATCH /api/me", () => {
  it("requires a session", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const response = await PATCH(patchRequest({}));
    expect(response.status).toBe(401);
    expect(mocks.updateUserProfile).not.toHaveBeenCalled();
  });

  it("updates nickname, city, role and profile extras", async () => {
    const response = await PATCH(
      patchRequest({
        nickname: " 新昵称 ",
        city: "深圳",
        roleTag: "founder",
        bio: "新的简介",
        skills: ["出海", "Agent"],
        yearsExperience: 15,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateUserProfile).toHaveBeenCalledWith("user-1", {
      nickname: "新昵称",
      city: "深圳",
      roleTag: "founder",
      bio: "新的简介",
      skills: ["出海", "Agent"],
      yearsExperience: 15,
    });
  });

  it("rejects missing nickname or city", async () => {
    const response = await PATCH(
      patchRequest({ nickname: "", city: "深圳", roleTag: "founder" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "请填写昵称和城市",
    });
    expect(mocks.updateUserProfile).not.toHaveBeenCalled();
  });

  it("rejects an invalid role", async () => {
    const response = await PATCH(
      patchRequest({
        nickname: "小明",
        city: "上海",
        roleTag: "hacker",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "请选择身份",
    });
  });
});
