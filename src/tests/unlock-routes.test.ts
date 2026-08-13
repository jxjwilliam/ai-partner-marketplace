import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  getPostAuthor: vi.fn(),
  countPendingUnlocksToday: vi.fn(),
  getUnlockStatus: vi.fn(),
  createUnlockRequest: vi.fn(),
  reopenUnlockRequest: vi.fn(),
  getUnlockRequest: vi.fn(),
  decideUnlockRequest: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/lib/data", () => ({
  getPostAuthor: mocks.getPostAuthor,
  countPendingUnlocksToday: mocks.countPendingUnlocksToday,
  getUnlockStatus: mocks.getUnlockStatus,
  createUnlockRequest: mocks.createUnlockRequest,
  reopenUnlockRequest: mocks.reopenUnlockRequest,
  getUnlockRequest: mocks.getUnlockRequest,
  decideUnlockRequest: mocks.decideUnlockRequest,
}));

import { POST as createUnlock } from "@/app/api/posts/[id]/unlock/route";
import { POST as decideUnlock } from "@/app/api/unlock/[requestId]/route";

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

function request(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessionUser.mockResolvedValue(viewer);
  mocks.getPostAuthor.mockResolvedValue({ authorId: "author-1", status: "active" });
  mocks.countPendingUnlocksToday.mockResolvedValue(0);
  mocks.getUnlockStatus.mockResolvedValue(null);
  mocks.createUnlockRequest.mockResolvedValue({
    id: "request-1",
    postId: "post-1",
    requesterId: "viewer-1",
    message: "我有相关经验",
    status: "pending",
    createdAt: new Date(),
    decidedAt: null,
  });
  mocks.reopenUnlockRequest.mockResolvedValue({
    id: "request-1",
    postId: "post-1",
    requesterId: "viewer-1",
    message: "重新提交",
    status: "pending",
    createdAt: new Date(),
    decidedAt: null,
  });
  mocks.getUnlockRequest.mockResolvedValue({
    id: "request-1",
    status: "pending",
    post: { authorId: "author-1" },
  });
  mocks.decideUnlockRequest.mockResolvedValue(true);
});

describe("POST /api/posts/[id]/unlock", () => {
  it("requires authentication before loading the post", async () => {
    mocks.getSessionUser.mockResolvedValue(null);

    const response = await createUnlock(
      request("http://localhost/api/posts/post-1/unlock", {
        message: "我有相关全栈经验，希望进一步沟通",
      }),
      { params: Promise.resolve({ id: "post-1" }) },
    );

    expect(response.status).toBe(401);
    expect(mocks.getPostAuthor).not.toHaveBeenCalled();
  });

  it("creates a pending request after checking today's pending count", async () => {
    const response = await createUnlock(
      request("http://localhost/api/posts/post-1/unlock", {
        message: "  我有相关全栈经验，希望进一步沟通  ",
      }),
      { params: Promise.resolve({ id: "post-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.countPendingUnlocksToday).toHaveBeenCalledWith(
      "viewer-1",
      expect.any(Date),
    );
    expect(mocks.createUnlockRequest).toHaveBeenCalledWith(
      "post-1",
      "viewer-1",
      "我有相关全栈经验，希望进一步沟通",
    );
    await expect(response.json()).resolves.toEqual({
      ok: true,
      request: { id: "request-1", status: "pending" },
    });
  });

  it("reopens a rejected request with a new message", async () => {
    mocks.getUnlockStatus.mockResolvedValue("rejected");

    const response = await createUnlock(
      request("http://localhost/api/posts/post-1/unlock", {
        message: "补充介绍：我做过类似产品，可以投入开发",
      }),
      { params: Promise.resolve({ id: "post-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.reopenUnlockRequest).toHaveBeenCalledWith(
      "post-1",
      "viewer-1",
      "补充介绍：我做过类似产品，可以投入开发",
    );
    expect(mocks.createUnlockRequest).not.toHaveBeenCalled();
  });

  it("rejects a duplicate pending request", async () => {
    mocks.getUnlockStatus.mockResolvedValue("pending");

    const response = await createUnlock(
      request("http://localhost/api/posts/post-1/unlock", {
        message: "我有相关全栈经验，希望进一步沟通",
      }),
      { params: Promise.resolve({ id: "post-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "已有待处理申请",
    });
  });
});

describe("POST /api/unlock/[requestId]", () => {
  it("allows only the post author to decide", async () => {
    const response = await decideUnlock(
      request("http://localhost/api/unlock/request-1", { action: "approve" }),
      { params: Promise.resolve({ requestId: "request-1" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.decideUnlockRequest).not.toHaveBeenCalled();
  });

  it("approves a pending request and records the decision", async () => {
    mocks.getSessionUser.mockResolvedValue({ ...viewer, id: "author-1" });
    const response = await decideUnlock(
      request("http://localhost/api/unlock/request-1", { action: "approve" }),
      { params: Promise.resolve({ requestId: "request-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.decideUnlockRequest).toHaveBeenCalledWith("request-1", "approved");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      request: { id: "request-1", status: "approved" },
    });
  });

  it("returns a conflict when another decision wins the pending update race", async () => {
    mocks.getSessionUser.mockResolvedValue({ ...viewer, id: "author-1" });
    mocks.decideUnlockRequest.mockResolvedValue(false);

    const response = await decideUnlock(
      request("http://localhost/api/unlock/request-1", { action: "reject" }),
      { params: Promise.resolve({ requestId: "request-1" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "申请已处理",
    });
  });

  it("rejects attempts to decide an already decided request", async () => {
    mocks.getSessionUser.mockResolvedValue({ ...viewer, id: "author-1" });
    mocks.getUnlockRequest.mockResolvedValue({
      id: "request-1",
      status: "approved",
      post: { authorId: "author-1" },
    });

    const response = await decideUnlock(
      request("http://localhost/api/unlock/request-1", { action: "reject" }),
      { params: Promise.resolve({ requestId: "request-1" }) },
    );

    expect(response.status).toBe(409);
    expect(mocks.decideUnlockRequest).not.toHaveBeenCalled();
  });
});
