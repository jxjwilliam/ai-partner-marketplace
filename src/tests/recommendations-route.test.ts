import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  listRecommendationItems: vi.fn(),
  refreshRecommendationsWithLlm: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
}));
vi.mock("@/lib/ai/match", () => ({
  RECOMMENDATIONS_PAGE_SIZE: 5,
  listRecommendationItems: mocks.listRecommendationItems,
  refreshRecommendationsWithLlm: mocks.refreshRecommendationsWithLlm,
}));

import { GET } from "@/app/api/recommendations/route";
import { POST as refresh } from "@/app/api/recommendations/refresh/route";

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

const items = [
  {
    post: { id: "post-1", type: "partner" as const, title: "找全栈合伙人", city: "上海" },
    score: 9,
    reason: "技能匹配",
  },
];

function request(url: string) {
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessionUser.mockResolvedValue(viewer);
  mocks.listRecommendationItems.mockResolvedValue({
    items,
    hasMore: false,
    llmReady: true,
  });
  mocks.refreshRecommendationsWithLlm.mockResolvedValue({ count: 5 });
});

describe("GET /api/recommendations", () => {
  it("requires authentication", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const response = await GET(request("http://localhost/api/recommendations"));
    expect(response.status).toBe(401);
    expect(mocks.listRecommendationItems).not.toHaveBeenCalled();
  });

  it("returns cached/rule recommendations fast without blocking on the LLM", async () => {
    const response = await GET(
      request("http://localhost/api/recommendations?limit=2&page=1"),
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.recommendations[0]).toMatchObject({
      reason: "技能匹配",
      post: { id: "post-1", title: "找全栈合伙人" },
    });
    expect(json.hasMore).toBe(false);
    expect(json.llmReady).toBe(true);
    expect(mocks.listRecommendationItems).toHaveBeenCalledWith(viewer, 1);
  });

  it("returns 503 when the fast path fails", async () => {
    mocks.listRecommendationItems.mockRejectedValue(new Error("db down"));
    const response = await GET(request("http://localhost/api/recommendations"));
    expect(response.status).toBe(503);
  });
});

describe("POST /api/recommendations/refresh", () => {
  it("requires authentication", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const response = await refresh(
      request("http://localhost/api/recommendations/refresh"),
    );
    expect(response.status).toBe(401);
    expect(mocks.refreshRecommendationsWithLlm).not.toHaveBeenCalled();
  });

  it("regenerates LLM reasons and returns the count", async () => {
    const response = await refresh(
      request("http://localhost/api/recommendations/refresh"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, count: 5 });
    expect(mocks.refreshRecommendationsWithLlm).toHaveBeenCalledWith(viewer);
  });

  it("returns 503 when generation fails", async () => {
    mocks.refreshRecommendationsWithLlm.mockRejectedValue(
      new Error("LLM down"),
    );
    const response = await refresh(
      request("http://localhost/api/recommendations/refresh"),
    );
    expect(response.status).toBe(503);
  });
});
