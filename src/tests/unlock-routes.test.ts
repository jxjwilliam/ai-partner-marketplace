import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  postFindUnique: vi.fn(),
  requestCount: vi.fn(),
  requestFindUnique: vi.fn(),
  requestCreate: vi.fn(),
  requestUpdate: vi.fn(),
  requestUpdateMany: vi.fn(),
  requestUpsert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    post: { findUnique: mocks.postFindUnique },
    contactRequest: {
      count: mocks.requestCount,
      findUnique: mocks.requestFindUnique,
      create: mocks.requestCreate,
      update: mocks.requestUpdate,
      updateMany: mocks.requestUpdateMany,
      upsert: mocks.requestUpsert,
    },
    $transaction: mocks.transaction,
  },
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
  mocks.postFindUnique.mockResolvedValue({
    id: "post-1",
    authorId: "author-1",
    status: "active",
  });
  mocks.requestCount.mockResolvedValue(0);
  mocks.requestFindUnique.mockResolvedValue(null);
  mocks.requestCreate.mockResolvedValue({ id: "request-1", status: "pending" });
  mocks.requestUpdateMany.mockResolvedValue({ count: 1 });
  mocks.requestUpsert.mockResolvedValue({ id: "request-1", status: "pending" });
  mocks.transaction.mockImplementation(
    async (
      callback: (tx: {
        contactRequest: {
          count: typeof mocks.requestCount;
          findUnique: typeof mocks.requestFindUnique;
          create: typeof mocks.requestCreate;
          upsert: typeof mocks.requestUpsert;
        };
      }) => unknown,
    ) =>
      callback({
        contactRequest: {
          count: mocks.requestCount,
          findUnique: mocks.requestFindUnique,
          create: mocks.requestCreate,
          upsert: mocks.requestUpsert,
        },
      }),
  );
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
    expect(mocks.postFindUnique).not.toHaveBeenCalled();
  });

  it("creates a pending request after checking today's pending count", async () => {
    const response = await createUnlock(
      request("http://localhost/api/posts/post-1/unlock", {
        message: "  我有相关全栈经验，希望进一步沟通  ",
      }),
      { params: Promise.resolve({ id: "post-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" },
    );
    expect(mocks.requestCount).toHaveBeenCalledWith({
      where: {
        requesterId: "viewer-1",
        status: "pending",
        createdAt: { gte: expect.any(Date) },
      },
    });
    expect(mocks.requestCreate).toHaveBeenCalledWith({
      data: {
        postId: "post-1",
        requesterId: "viewer-1",
        message: "我有相关全栈经验，希望进一步沟通",
      },
      select: { id: true, status: true },
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      request: { id: "request-1", status: "pending" },
    });
  });

  it("reopens a rejected unique request with a new message", async () => {
    mocks.requestFindUnique.mockResolvedValue({
      id: "request-1",
      status: "rejected",
    });

    const response = await createUnlock(
      request("http://localhost/api/posts/post-1/unlock", {
        message: "补充介绍：我做过类似产品，可以投入开发",
      }),
      { params: Promise.resolve({ id: "post-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestUpsert).toHaveBeenCalledWith({
      where: {
        postId_requesterId: {
          postId: "post-1",
          requesterId: "viewer-1",
        },
      },
      create: {
        postId: "post-1",
        requesterId: "viewer-1",
        message: "补充介绍：我做过类似产品，可以投入开发",
      },
      update: {
        message: "补充介绍：我做过类似产品，可以投入开发",
        status: "pending",
        decidedAt: null,
        createdAt: expect.any(Date),
      },
      select: { id: true, status: true },
    });
  });
});

describe("POST /api/unlock/[requestId]", () => {
  beforeEach(() => {
    mocks.requestFindUnique.mockResolvedValue({
      id: "request-1",
      status: "pending",
      post: { authorId: "author-1" },
    });
  });

  it("allows only the post author to decide", async () => {
    const response = await decideUnlock(
      request("http://localhost/api/unlock/request-1", { action: "approve" }),
      { params: Promise.resolve({ requestId: "request-1" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.requestUpdate).not.toHaveBeenCalled();
  });

  it("approves a pending request and records the decision time", async () => {
    mocks.getSessionUser.mockResolvedValue({ ...viewer, id: "author-1" });
    const response = await decideUnlock(
      request("http://localhost/api/unlock/request-1", { action: "approve" }),
      { params: Promise.resolve({ requestId: "request-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestUpdateMany).toHaveBeenCalledWith({
      where: { id: "request-1", status: "pending" },
      data: { status: "approved", decidedAt: expect.any(Date) },
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      request: { id: "request-1", status: "approved" },
    });
  });

  it("returns a conflict when another decision wins the pending update race", async () => {
    mocks.getSessionUser.mockResolvedValue({ ...viewer, id: "author-1" });
    mocks.requestUpdateMany.mockResolvedValue({ count: 0 });

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
    mocks.requestFindUnique.mockResolvedValue({
      id: "request-1",
      status: "approved",
      post: { authorId: "author-1" },
    });

    const response = await decideUnlock(
      request("http://localhost/api/unlock/request-1", { action: "reject" }),
      { params: Promise.resolve({ requestId: "request-1" }) },
    );

    expect(response.status).toBe(409);
    expect(mocks.requestUpdate).not.toHaveBeenCalled();
  });
});
