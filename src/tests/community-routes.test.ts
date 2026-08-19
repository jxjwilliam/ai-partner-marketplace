import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  countCommunityPostsSince: vi.fn(),
  createCommunityPost: vi.fn(),
  deleteCommunityPost: vi.fn(),
  getCommunityPost: vi.fn(),
  getPostAuthor: vi.fn(),
  countCommentsSince: vi.fn(),
  createComment: vi.fn(),
  deleteComment: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/lib/data", () => ({
  countCommunityPostsSince: mocks.countCommunityPostsSince,
  createCommunityPost: mocks.createCommunityPost,
  deleteCommunityPost: mocks.deleteCommunityPost,
  getCommunityPost: mocks.getCommunityPost,
  getPostAuthor: mocks.getPostAuthor,
  countCommentsSince: mocks.countCommentsSince,
  createComment: mocks.createComment,
  deleteComment: mocks.deleteComment,
}));

import { POST as createCommunityPost } from "@/app/api/community/route";
import { DELETE as deleteCommunity } from "@/app/api/community/[id]/route";
import { POST as createCommentRoute } from "@/app/api/comments/route";
import { DELETE as deleteCommentRoute } from "@/app/api/comments/[id]/route";

const viewer = {
  id: "viewer-1",
  phone: "13800138000",
  email: null,
  nickname: "小明",
  city: "上海",
  roleTag: "talent",
  bio: null,
  skills: [],
  yearsExperience: 12,
  isVerified: false,
  isAdmin: false,
  createdAt: new Date("2026-01-01"),
};

function postRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest(url: string): NextRequest {
  return new NextRequest(url, { method: "DELETE" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessionUser.mockResolvedValue(viewer);
  mocks.countCommunityPostsSince.mockResolvedValue(0);
  mocks.createCommunityPost.mockResolvedValue({ id: "post-1" });
  mocks.deleteCommunityPost.mockResolvedValue(true);
  mocks.getCommunityPost.mockResolvedValue({
    id: "post-1",
    authorId: "author-1",
    status: "active",
  });
  mocks.getPostAuthor.mockResolvedValue({ authorId: "author-1", status: "active" });
  mocks.countCommentsSince.mockResolvedValue(0);
  mocks.createComment.mockResolvedValue({ id: "comment-1" });
  mocks.deleteComment.mockResolvedValue(true);
});

describe("POST /api/community", () => {
  it("requires authentication", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const response = await createCommunityPost(
      postRequest("http://localhost/api/community", { body: "大家好" }),
    );
    expect(response.status).toBe(401);
    expect(mocks.createCommunityPost).not.toHaveBeenCalled();
  });

  it("rejects empty or oversized content", async () => {
    const empty = await createCommunityPost(
      postRequest("http://localhost/api/community", { body: "   " }),
    );
    expect(empty.status).toBe(400);
    const long = await createCommunityPost(
      postRequest("http://localhost/api/community", { body: "a".repeat(1001) }),
    );
    expect(long.status).toBe(400);
    expect(mocks.createCommunityPost).not.toHaveBeenCalled();
  });

  it("masks contact info and creates the post", async () => {
    const response = await createCommunityPost(
      postRequest("http://localhost/api/community", {
        body: "有项目找我，电话 13800138000",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.createCommunityPost).toHaveBeenCalledWith(
      "viewer-1",
      expect.stringContaining("[已隐藏]"),
    );
  });

  it("rate limits to 20 posts per day", async () => {
    mocks.countCommunityPostsSince.mockResolvedValue(20);
    const response = await createCommunityPost(
      postRequest("http://localhost/api/community", { body: "再来一条" }),
    );
    expect(response.status).toBe(429);
    expect(mocks.createCommunityPost).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/community/[id]", () => {
  it("requires authentication", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const response = await deleteCommunity(deleteRequest("http://localhost/api/community/post-1"), {
      params: Promise.resolve({ id: "post-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 when the post is not owned by the viewer", async () => {
    mocks.deleteCommunityPost.mockResolvedValue(false);
    const response = await deleteCommunity(deleteRequest("http://localhost/api/community/post-1"), {
      params: Promise.resolve({ id: "post-1" }),
    });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "动态不存在或无权删除",
    });
  });

  it("deletes the viewer's own post", async () => {
    const response = await deleteCommunity(deleteRequest("http://localhost/api/community/post-1"), {
      params: Promise.resolve({ id: "post-1" }),
    });
    expect(response.status).toBe(200);
    expect(mocks.deleteCommunityPost).toHaveBeenCalledWith("post-1", "viewer-1");
  });
});

describe("POST /api/comments", () => {
  it("requires authentication", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const response = await createCommentRoute(
      postRequest("http://localhost/api/comments", {
        targetType: "community",
        targetId: "post-1",
        body: "说得对",
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects an invalid target", async () => {
    const response = await createCommentRoute(
      postRequest("http://localhost/api/comments", {
        targetType: "unknown",
        targetId: "post-1",
        body: "说得对",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects comments on a missing or hidden target", async () => {
    mocks.getCommunityPost.mockResolvedValue(null);
    const response = await createCommentRoute(
      postRequest("http://localhost/api/comments", {
        targetType: "community",
        targetId: "missing",
        body: "说得对",
      }),
    );
    expect(response.status).toBe(404);
  });

  it("creates a comment on a listing post", async () => {
    const response = await createCommentRoute(
      postRequest("http://localhost/api/comments", {
        targetType: "listing",
        targetId: "post-9",
        body: "这个需求我做过类似的",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.createComment).toHaveBeenCalledWith({
      authorId: "viewer-1",
      communityPostId: undefined,
      listingPostId: "post-9",
      body: "这个需求我做过类似的",
    });
  });

  it("rate limits to 50 comments per day", async () => {
    mocks.countCommentsSince.mockResolvedValue(50);
    const response = await createCommentRoute(
      postRequest("http://localhost/api/comments", {
        targetType: "community",
        targetId: "post-1",
        body: "再评一条",
      }),
    );
    expect(response.status).toBe(429);
    expect(mocks.createComment).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/comments/[id]", () => {
  it("requires authentication", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const response = await deleteCommentRoute(deleteRequest("http://localhost/api/comments/comment-1"), {
      params: Promise.resolve({ id: "comment-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("deletes the viewer's own comment", async () => {
    const response = await deleteCommentRoute(deleteRequest("http://localhost/api/comments/comment-1"), {
      params: Promise.resolve({ id: "comment-1" }),
    });
    expect(response.status).toBe(200);
    expect(mocks.deleteComment).toHaveBeenCalledWith("comment-1", "viewer-1");
  });
});
