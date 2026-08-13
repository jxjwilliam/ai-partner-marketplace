import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  listPosts: vi.fn(),
  createPost: vi.fn(),
  getPostById: vi.fn(),
  getPostAuthor: vi.fn(),
  getUnlockStatus: vi.fn(),
  incrementPostViews: vi.fn(),
  updatePostStatusOrBump: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/lib/data", () => ({
  listPosts: mocks.listPosts,
  createPost: mocks.createPost,
  getPostById: mocks.getPostById,
  getPostAuthor: mocks.getPostAuthor,
  getUnlockStatus: mocks.getUnlockStatus,
  incrementPostViews: mocks.incrementPostViews,
  updatePostStatusOrBump: mocks.updatePostStatusOrBump,
}));

import { GET as listPosts, POST as createPost } from "@/app/api/posts/route";
import {
  GET as getPost,
  PATCH as patchPost,
} from "@/app/api/posts/[id]/route";

const viewer = {
  id: "viewer-1",
  phone: "13800138000",
  nickname: "访客",
  city: "北京",
  roleTag: "talent",
  bio: null,
  skills: [],
  yearsExperience: null,
  isVerified: false,
  isAdmin: false,
  createdAt: new Date("2026-01-01"),
};

const post = {
  id: "post-1",
  authorId: "author-1",
  type: "partner",
  title: "寻找技术合伙人",
  city: "上海",
  tags: ["AI大模型"],
  bodyJson: { intro: "已完成首版产品" },
  contactPrivate: "微信：founder",
  status: "active",
  viewCount: 3,
  createdAt: new Date("2026-07-01"),
  bumpedAt: new Date("2026-07-02"),
  author: {
    id: "author-1",
    phone: "13900000001",
    nickname: "创业者",
    city: "上海",
    roleTag: "founder",
    bio: null,
    skills: [],
    yearsExperience: null,
    isVerified: true,
    isAdmin: false,
    createdAt: new Date("2026-07-01"),
  },
};

function request(url: string, method = "GET", body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessionUser.mockResolvedValue(viewer);
  mocks.listPosts.mockResolvedValue({ posts: [post], hasMore: false });
  mocks.createPost.mockResolvedValue({ id: "created-1" });
  mocks.getPostById.mockResolvedValue(post);
  mocks.getPostAuthor.mockResolvedValue({ authorId: "author-1", status: "active" });
  mocks.getUnlockStatus.mockResolvedValue(null);
  mocks.incrementPostViews.mockResolvedValue(4);
  mocks.updatePostStatusOrBump.mockResolvedValue(undefined);
});

describe("GET /api/posts", () => {
  it("returns 400 for an invalid type filter", async () => {
    const response = await listPosts(
      request("http://localhost/api/posts?type=invalid"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "类型无效",
    });
    expect(mocks.listPosts).not.toHaveBeenCalled();
  });

  it("lists filtered active posts with paging and search", async () => {
    const response = await listPosts(
      request(
        "http://localhost/api/posts?city=上海&type=partner&tags=AI大模型,SaaS&q=客服&sort=hot&page=2",
      ),
    );

    expect(mocks.listPosts).toHaveBeenCalledWith({
      city: "上海",
      type: "partner",
      tags: ["AI大模型", "SaaS"],
      search: "客服",
      sort: "hot",
      page: 2,
    });
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.hasMore).toBe(false);
    expect(json.page).toBe(2);
  });
});

describe("POST /api/posts", () => {
  it("requires authentication", async () => {
    mocks.getSessionUser.mockResolvedValue(null);

    const response = await createPost(
      request("http://localhost/api/posts", "POST", {}),
    );

    expect(response.status).toBe(401);
    expect(mocks.createPost).not.toHaveBeenCalled();
  });

  it("validates and creates a post for the viewer", async () => {
    const input = {
      type: "partner",
      title: "寻找技术合伙人",
      city: "上海",
      tags: ["AI大模型"],
      contactPrivate: "微信：founder",
      body: {
        projectStage: "MVP",
        intro: "已完成首版产品",
        techNeeds: "全栈开发",
        cooperationModes: ["股权合伙"],
      },
    };

    const response = await createPost(
      request("http://localhost/api/posts", "POST", input),
    );

    expect(response.status).toBe(200);
    expect(mocks.createPost).toHaveBeenCalledWith({
      authorId: "viewer-1",
      type: "partner",
      title: "寻找技术合伙人",
      city: "上海",
      tags: ["AI大模型"],
      contactPrivate: "微信：founder",
      body: input.body,
    });
    await expect(response.json()).resolves.toEqual({ ok: true, id: "created-1" });
  });
});

describe("GET /api/posts/[id]", () => {
  it("returns 404 for a hidden post viewed by another non-admin user", async () => {
    mocks.getPostById.mockResolvedValue({ ...post, status: "hidden" });

    const response = await getPost(request("http://localhost/api/posts/post-1"), {
      params: Promise.resolve({ id: "post-1" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.incrementPostViews).not.toHaveBeenCalled();
  });

  it("increments views and reveals approved contact details", async () => {
    mocks.getUnlockStatus.mockResolvedValue("approved");
    mocks.incrementPostViews.mockResolvedValue(99);

    const response = await getPost(request("http://localhost/api/posts/post-1"), {
      params: Promise.resolve({ id: "post-1" }),
    });

    expect(mocks.incrementPostViews).toHaveBeenCalledWith("post-1");
    const json = await response.json();
    expect(json.post.contactPrivate).toBe("微信：founder");
    expect(json.post.viewCount).toBe(99);
  });

  it("omits contact details when no approved unlock exists", async () => {
    const response = await getPost(request("http://localhost/api/posts/post-1"), {
      params: Promise.resolve({ id: "post-1" }),
    });

    const json = await response.json();
    expect(json.post).not.toHaveProperty("contactPrivate");
  });
});

describe("PATCH /api/posts/[id]", () => {
  it("rejects viewers who are neither the author nor an admin", async () => {
    const response = await patchPost(
      request("http://localhost/api/posts/post-1", "PATCH", { bump: true }),
      { params: Promise.resolve({ id: "post-1" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.updatePostStatusOrBump).not.toHaveBeenCalled();
  });

  it("lets an author hide and bump a post", async () => {
    mocks.getSessionUser.mockResolvedValue({ ...viewer, id: "author-1" });

    const response = await patchPost(
      request("http://localhost/api/posts/post-1", "PATCH", {
        status: "hidden",
        bump: true,
      }),
      { params: Promise.resolve({ id: "post-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.updatePostStatusOrBump).toHaveBeenCalledWith("post-1", {
      hide: true,
      bump: true,
    });
  });

  it("lets an admin hide a post without bumping", async () => {
    mocks.getSessionUser.mockResolvedValue({ ...viewer, isAdmin: true });

    const response = await patchPost(
      request("http://localhost/api/posts/post-1", "PATCH", {
        status: "hidden",
      }),
      { params: Promise.resolve({ id: "post-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.updatePostStatusOrBump).toHaveBeenCalledWith("post-1", {
      hide: true,
      bump: false,
    });
  });

  it("rejects admins who try to bump a post", async () => {
    mocks.getSessionUser.mockResolvedValue({ ...viewer, isAdmin: true });

    const response = await patchPost(
      request("http://localhost/api/posts/post-1", "PATCH", { bump: true }),
      { params: Promise.resolve({ id: "post-1" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.updatePostStatusOrBump).not.toHaveBeenCalled();
  });
});
