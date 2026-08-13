import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  recommendForUser: vi.fn(),
  getPostsByIds: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
}));
vi.mock("@/lib/ai/match", () => ({
  recommendForUser: mocks.recommendForUser,
}));
vi.mock("@/lib/data", () => ({
  getPostsByIds: mocks.getPostsByIds,
}));

import { GET } from "@/app/api/recommendations/route";

const viewer = {
  id: "user-1",
  phone: "13800138000",
  nickname: "小明",
  city: "上海",
  roleTag: "talent",
  bio: null,
  skills: ["全栈"],
  yearsExperience: 10,
  isVerified: false,
  isAdmin: false,
  createdAt: new Date("2026-01-01"),
};

function request(url: string) {
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessionUser.mockResolvedValue(viewer);
  mocks.recommendForUser.mockResolvedValue([
    { postId: "post-1", score: 9, reason: "技能匹配" },
  ]);
  mocks.getPostsByIds.mockResolvedValue([
    {
      id: "post-1",
      type: "partner",
      title: "找全栈合伙人",
      city: "上海",
      tags: ["全栈"],
      bodyJson: {},
      viewCount: 1,
      createdAt: new Date(),
      bumpedAt: new Date(),
      author: null,
    },
  ]);
});

describe("GET /api/recommendations", () => {
  it("requires authentication", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const response = await GET(request("http://localhost/api/recommendations"));
    expect(response.status).toBe(401);
    expect(mocks.recommendForUser).not.toHaveBeenCalled();
  });

  it("returns recommended posts with reasons", async () => {
    const response = await GET(
      request("http://localhost/api/recommendations?limit=2"),
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.recommendations[0]).toMatchObject({
      reason: "技能匹配",
      post: { id: "post-1", title: "找全栈合伙人" },
    });
  });

  it("returns 503 when matching fails", async () => {
    mocks.recommendForUser.mockRejectedValue(new Error("LLM down"));
    const response = await GET(request("http://localhost/api/recommendations"));
    expect(response.status).toBe(503);
  });
});
