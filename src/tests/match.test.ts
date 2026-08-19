import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fallbackReason,
  generateMatchReasons,
  listRecommendationItems,
  recommendForHome,
  recommendForUser,
  refreshRecommendationsWithLlm,
  scorePostForUser,
} from "@/lib/ai/match";
import type { User } from "@/lib/types";

const dataMocks = vi.hoisted(() => ({
  getCachedRecommendations: vi.fn(),
  getPostsByIds: vi.fn(),
  listPostsForMatching: vi.fn(),
  upsertRecommendations: vi.fn(),
}));

vi.mock("@/lib/data", () => dataMocks);

const user: User = {
  id: "user-1",
  phone: "13800138000",
  nickname: "小明",
  city: "上海",
  roleTag: "talent",
  bio: "全栈工程师，电话 13800138000",
  skills: ["全栈", "AI大模型"],
  yearsExperience: 12,
  isVerified: false,
  isAdmin: false,
  createdAt: new Date("2026-01-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
  dataMocks.getCachedRecommendations.mockResolvedValue([]);
  dataMocks.getPostsByIds.mockResolvedValue([]);
  dataMocks.listPostsForMatching.mockResolvedValue([]);
  dataMocks.upsertRecommendations.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scorePostForUser", () => {
  it("rewards skill, same-city and role affinity", () => {
    const detail = scorePostForUser(user, {
      id: "post-1",
      authorId: "other",
      type: "partner",
      title: "找全栈 AI 合伙人",
      city: "上海",
      tags: ["全栈", "AI大模型"],
      bodyJson: { intro: "需要全栈工程师" },
    });
    expect(detail.score).toBeGreaterThan(10);
    expect(detail.reasons.join(" ")).toContain("技能匹配");
    expect(detail.reasons.join(" ")).toContain("同城");
    expect(detail.reasons.join(" ")).toContain("技术人才");
  });

  it("prefers remote posts when user city differs", () => {
    const detail = scorePostForUser(user, {
      id: "post-2",
      authorId: "other",
      type: "project",
      title: "远程项目",
      city: "远程",
      tags: ["全栈"],
      bodyJson: {},
    });
    expect(detail.reasons).toContain("支持远程");
    expect(detail.score).toBeGreaterThan(0);
  });

  it("scores zero for unrelated posts", () => {
    const detail = scorePostForUser(user, {
      id: "post-3",
      authorId: "other",
      type: "funding",
      title: "宠物医疗融资",
      city: "成都",
      tags: ["出海"],
      bodyJson: {},
    });
    expect(detail.score).toBe(0);
  });
});

describe("fallbackReason", () => {
  it("joins the top reasons", () => {
    expect(
      fallbackReason({ score: 8, reasons: ["技能匹配", "同城（上海）"] }),
    ).toBe("技能匹配；同城（上海）");
  });
});

describe("generateMatchReasons", () => {
  it("sanitizes contact info before calling the LLM", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '[{"post_id":"post-1","reason":"技能匹配，值得沟通"}]',
              },
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("OPENAI_COMPATIBLE_API_KEY", "test-key");
    vi.stubEnv("OPENAI_COMPATIBLE_BASE_URL", "https://llm.example.com");

    const reasons = await generateMatchReasons(user, [
      {
        id: "post-1",
        authorId: "other",
        type: "partner",
        title: "找全栈合伙人，微信 abc12345",
        city: "上海",
        tags: ["全栈"],
        bodyJson: { intro: "联系方式 13800138000" },
      },
    ]);

    expect(reasons["post-1"]).toBe("技能匹配，值得沟通");
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("13800138000");
    expect(serialized).not.toContain("abc12345");
  });

  it("aborts the LLM request when the timeout budget elapses", async () => {
    vi.stubEnv("OPENAI_COMPATIBLE_API_KEY", "test-key");
    vi.stubEnv("OPENAI_COMPATIBLE_BASE_URL", "https://llm.example.com");
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "[]" } }],
          }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = generateMatchReasons(
      user,
      [
        {
          id: "post-1",
          authorId: "other",
          type: "partner",
          title: "找全栈合伙人",
          city: "上海",
          tags: ["全栈"],
          bodyJson: {},
        },
      ],
      200,
    );
    const signal = fetchMock.mock.calls[0][1]?.signal as AbortSignal;
    expect(signal).toBeInstanceOf(AbortSignal);

    await promise;
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(signal.aborted).toBe(true);
  });
});

describe("recommendForUser", () => {
  it("uses cached recommendations when fresh", async () => {
    dataMocks.getCachedRecommendations.mockResolvedValue([
      { postId: "post-1", score: 9, reason: "缓存理由" },
    ]);

    const items = await recommendForUser(user, 1);
    expect(items).toEqual([{ postId: "post-1", score: 9, reason: "缓存理由" }]);
    expect(dataMocks.listPostsForMatching).not.toHaveBeenCalled();
  });

  it("scores, reasons and persists on cache miss", async () => {
    dataMocks.listPostsForMatching.mockResolvedValue([
      {
        id: "post-1",
        authorId: "other",
        type: "partner",
        title: "找全栈合伙人",
        city: "上海",
        tags: ["全栈", "AI大模型"],
        bodyJson: {},
      },
      {
        id: "post-2",
        authorId: "other",
        type: "funding",
        title: "无关项目",
        city: "成都",
        tags: ["出海"],
        bodyJson: {},
      },
    ]);
    vi.stubEnv("OPENAI_COMPATIBLE_API_KEY", "test-key");
    vi.stubEnv("OPENAI_COMPATIBLE_BASE_URL", "https://llm.example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ choices: [] }))),
    );

    const items = await recommendForUser(user, 2);
    expect(items[0].postId).toBe("post-1");
    expect(items[0].reason.length).toBeGreaterThan(0);
    expect(dataMocks.upsertRecommendations).toHaveBeenCalledTimes(1);
  });

  it("passes the caller-provided LLM timeout into the request", async () => {
    dataMocks.listPostsForMatching.mockResolvedValue([
      {
        id: "post-1",
        authorId: "other",
        type: "partner",
        title: "找全栈合伙人",
        city: "上海",
        tags: ["全栈", "AI大模型"],
        bodyJson: {},
      },
    ]);
    vi.stubEnv("OPENAI_COMPATIBLE_API_KEY", "test-key");
    vi.stubEnv("OPENAI_COMPATIBLE_BASE_URL", "https://llm.example.com");
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "[]" } }],
          }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const items = await recommendForUser(user, 1, { llmTimeoutMs: 200 });
    const signal = fetchMock.mock.calls[0][1]?.signal as AbortSignal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(items.length).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(signal.aborted).toBe(true);
  });

  it("returns rule-based reasons instantly and skips the LLM when skipLlm is set", async () => {
    dataMocks.listPostsForMatching.mockResolvedValue([
      {
        id: "post-1",
        authorId: "other",
        type: "partner",
        title: "找全栈合伙人",
        city: "上海",
        tags: ["全栈", "AI大模型"],
        bodyJson: {},
      },
    ]);
    const fetchMock = vi.fn(async () => {
      throw new Error("LLM must not be called on the homepage path");
    });
    vi.stubGlobal("fetch", fetchMock);

    const items = await recommendForUser(user, 1, { skipLlm: true });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(dataMocks.upsertRecommendations).not.toHaveBeenCalled();
    expect(items).toEqual([
      { postId: "post-1", score: expect.any(Number), reason: expect.any(String) },
    ]);
  });
});

describe("recommendForHome", () => {
  it("scores matching posts directly on cache miss without an extra fetch", async () => {
    dataMocks.listPostsForMatching.mockResolvedValue([
      {
        id: "post-1",
        authorId: "other",
        type: "partner",
        title: "找全栈合伙人",
        city: "上海",
        tags: ["全栈", "AI大模型"],
        bodyJson: {},
      },
      {
        id: "post-2",
        authorId: "other",
        type: "funding",
        title: "无关项目",
        city: "成都",
        tags: ["出海"],
        bodyJson: {},
      },
    ]);

    const items = await recommendForHome(user, 1);

    expect(items).toHaveLength(1);
    expect(items[0].post).toEqual({
      id: "post-1",
      type: "partner",
      title: "找全栈合伙人",
      city: "上海",
    });
    expect(items[0].reason.length).toBeGreaterThan(0);
    expect(dataMocks.getPostsByIds).not.toHaveBeenCalled();
    expect(dataMocks.upsertRecommendations).not.toHaveBeenCalled();
  });

  it("reuses cached reasons and post details on a fresh cache hit", async () => {
    dataMocks.getCachedRecommendations.mockResolvedValue([
      { postId: "post-1", score: 9, reason: "缓存理由" },
    ]);
    dataMocks.getPostsByIds.mockResolvedValue([
      {
        id: "post-1",
        type: "partner",
        title: "找全栈合伙人",
        city: "上海",
        tags: [],
        bodyJson: {},
        viewCount: 3,
        createdAt: new Date(),
        bumpedAt: new Date(),
        author: null,
      },
    ]);

    const items = await recommendForHome(user, 1);

    expect(items).toEqual([
      {
        post: {
          id: "post-1",
          type: "partner",
          title: "找全栈合伙人",
          city: "上海",
        },
        score: 9,
        reason: "缓存理由",
      },
    ]);
    expect(dataMocks.getPostsByIds).toHaveBeenCalledWith(["post-1"]);
  });
});

describe("listRecommendationItems", () => {
  it("returns cached pages instantly and marks LLM reasons ready", async () => {
    dataMocks.getCachedRecommendations.mockResolvedValue([
      { postId: "post-1", score: 9, reason: "缓存 AI 理由", llm: true },
    ]);
    dataMocks.getPostsByIds.mockResolvedValue([
      {
        id: "post-1",
        type: "partner",
        title: "找全栈合伙人",
        city: "上海",
        tags: [],
        bodyJson: {},
        viewCount: 1,
        createdAt: new Date(),
        bumpedAt: new Date(),
        author: null,
      },
    ]);

    const result = await listRecommendationItems(user, 1);

    expect(result.llmReady).toBe(true);
    expect(result.items[0]).toEqual({
      post: { id: "post-1", type: "partner", title: "找全栈合伙人", city: "上海" },
      score: 9,
      reason: "缓存 AI 理由",
    });
    expect(dataMocks.listPostsForMatching).not.toHaveBeenCalled();
  });

  it("scores instantly on cache miss and caches rule results for next visit", async () => {
    dataMocks.listPostsForMatching.mockResolvedValue([
      {
        id: "post-1",
        authorId: "other",
        type: "partner",
        title: "找全栈合伙人",
        city: "上海",
        tags: ["全栈", "AI大模型"],
        bodyJson: {},
      },
    ]);

    const result = await listRecommendationItems(user, 1);

    expect(result.llmReady).toBe(false);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].post?.id).toBe("post-1");
    expect(dataMocks.upsertRecommendations).toHaveBeenCalledWith("user-1", [
      expect.objectContaining({ postId: "post-1", llm: false }),
    ]);
  });
});

describe("refreshRecommendationsWithLlm", () => {
  it("generates LLM reasons and writes them to the cache", async () => {
    dataMocks.listPostsForMatching.mockResolvedValue([
      {
        id: "post-1",
        authorId: "other",
        type: "partner",
        title: "找全栈合伙人",
        city: "上海",
        tags: ["全栈", "AI大模型"],
        bodyJson: {},
      },
    ]);
    vi.stubEnv("OPENAI_COMPATIBLE_API_KEY", "test-key");
    vi.stubEnv("OPENAI_COMPATIBLE_BASE_URL", "https://llm.example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: '[{"post_id":"post-1","reason":"技能匹配，值得沟通"}]',
                  },
                },
              ],
            }),
          ),
      ),
    );

    const result = await refreshRecommendationsWithLlm(user);

    expect(result.count).toBe(1);
    expect(dataMocks.upsertRecommendations).toHaveBeenCalledWith("user-1", [
      expect.objectContaining({
        postId: "post-1",
        reason: "技能匹配，值得沟通",
        llm: true,
      }),
    ]);
  });

  it("falls back to rule reasons when the LLM is unavailable", async () => {
    dataMocks.listPostsForMatching.mockResolvedValue([
      {
        id: "post-1",
        authorId: "other",
        type: "partner",
        title: "找全栈合伙人",
        city: "上海",
        tags: ["全栈", "AI大模型"],
        bodyJson: {},
      },
    ]);
    vi.stubEnv("OPENAI_COMPATIBLE_API_KEY", "test-key");
    vi.stubEnv("OPENAI_COMPATIBLE_BASE_URL", "https://llm.example.com");
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("LLM down");
    }));

    const result = await refreshRecommendationsWithLlm(user);

    expect(result.count).toBe(1);
    expect(dataMocks.upsertRecommendations).toHaveBeenCalledWith("user-1", [
      expect.objectContaining({
        postId: "post-1",
        llm: true,
        reason: expect.any(String),
      }),
    ]);
  });
});
