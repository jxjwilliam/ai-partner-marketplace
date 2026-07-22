import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  postFindMany: vi.fn(),
  postFindUnique: vi.fn(),
  postCreate: vi.fn(),
  postUpdate: vi.fn(),
  unlockFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    post: {
      findMany: mocks.postFindMany,
      findUnique: mocks.postFindUnique,
      create: mocks.postCreate,
      update: mocks.postUpdate,
    },
    contactRequest: {
      findUnique: mocks.unlockFindUnique,
    },
  },
}));

import { GET as listPosts, POST as createPost } from "@/app/api/posts/route";
import {
  GET as getPost,
  PATCH as patchPost,
} from "@/app/api/posts/[id]/route";

const author = {
  id: "author-1",
  nickname: "创业者",
  city: "上海",
  roleTag: "founder",
};

const post = {
  id: "post-1",
  authorId: "author-1",
  type: "partner",
  title: "寻找技术合伙人",
  city: "上海",
  tags: ["AI大模型"],
  bodyJson: { projectStage: "MVP" },
  contactPrivate: "微信：founder",
  status: "active",
  viewCount: 3,
  createdAt: new Date("2026-01-01"),
  bumpedAt: new Date("2026-01-02"),
  author,
};

const viewer = {
  id: "viewer-1",
  phone: "13800138000",
  nickname: "访客",
  city: "北京",
  roleTag: "talent",
  bio: null,
  isAdmin: false,
  createdAt: new Date("2026-01-01"),
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
  mocks.postFindMany.mockResolvedValue([post]);
  mocks.postFindUnique.mockResolvedValue(post);
  mocks.postCreate.mockResolvedValue({ id: "created-1" });
  mocks.postUpdate.mockResolvedValue({ ...post, viewCount: 4 });
  mocks.unlockFindUnique.mockResolvedValue(null);
});

describe("GET /api/posts", () => {
  it("lists filtered active posts without private contact details", async () => {
    const response = await listPosts(
      request(
        "http://localhost/api/posts?city=上海&type=partner&tags=AI大模型,SaaS",
      ),
    );

    expect(mocks.postFindMany).toHaveBeenCalledWith({
      where: {
        status: "active",
        city: "上海",
        type: "partner",
        AND: [
          { tags: { has: "AI大模型" } },
          { tags: { has: "SaaS" } },
        ],
      },
      orderBy: { bumpedAt: "desc" },
      include: {
        author: {
          select: { id: true, nickname: true, city: true, roleTag: true },
        },
      },
      take: 50,
    });
    const json = await response.json();
    expect(json.posts[0]).not.toHaveProperty("contactPrivate");
  });
});

describe("POST /api/posts", () => {
  it("requires authentication", async () => {
    mocks.getSessionUser.mockResolvedValue(null);

    const response = await createPost(
      request("http://localhost/api/posts", "POST", {}),
    );

    expect(response.status).toBe(401);
    expect(mocks.postCreate).not.toHaveBeenCalled();
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
    expect(mocks.postCreate).toHaveBeenCalledWith({
      data: {
        authorId: "viewer-1",
        type: "partner",
        title: "寻找技术合伙人",
        city: "上海",
        tags: ["AI大模型"],
        contactPrivate: "微信：founder",
        bodyJson: input.body,
      },
      select: { id: true },
    });
    await expect(response.json()).resolves.toEqual({ ok: true, id: "created-1" });
  });
});

describe("GET /api/posts/[id]", () => {
  it("returns 404 for a hidden post viewed by another non-admin user", async () => {
    mocks.postFindUnique.mockResolvedValue({ ...post, status: "hidden" });

    const response = await getPost(request("http://localhost/api/posts/post-1"), {
      params: Promise.resolve({ id: "post-1" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.postUpdate).not.toHaveBeenCalled();
  });

  it("increments views and reveals approved contact details", async () => {
    mocks.unlockFindUnique.mockResolvedValue({ status: "approved" });

    const response = await getPost(request("http://localhost/api/posts/post-1"), {
      params: Promise.resolve({ id: "post-1" }),
    });

    expect(mocks.postUpdate).toHaveBeenCalledWith({
      where: { id: "post-1" },
      data: { viewCount: { increment: 1 } },
    });
    const json = await response.json();
    expect(json.post.contactPrivate).toBe("微信：founder");
    expect(json.post.viewCount).toBe(4);
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
    expect(mocks.postUpdate).not.toHaveBeenCalled();
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
    const update = mocks.postUpdate.mock.calls[0][0];
    expect(update.where).toEqual({ id: "post-1" });
    expect(update.data.status).toBe("hidden");
    expect(update.data.bumpedAt).toBeInstanceOf(Date);
  });
});
