import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hashOtp } from "@/lib/auth/otp";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  otpFindFirst: vi.fn(),
  otpCount: vi.fn(),
  otpCreate: vi.fn(),
  otpUpdate: vi.fn(),
  otpUpdateMany: vi.fn(),
  otpDelete: vi.fn(),
  otpDeleteMany: vi.fn(),
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  sendSmsOtp: vi.fn(),
  createSession: vi.fn(),
  setSessionCookie: vi.fn(),
  destroySession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    otpCode: {
      findFirst: mocks.otpFindFirst,
      count: mocks.otpCount,
      create: mocks.otpCreate,
      update: mocks.otpUpdate,
      updateMany: mocks.otpUpdateMany,
      delete: mocks.otpDelete,
      deleteMany: mocks.otpDeleteMany,
    },
    user: {
      findUnique: mocks.userFindUnique,
      create: mocks.userCreate,
    },
  },
}));

vi.mock("@/lib/auth/sms", () => ({ sendSmsOtp: mocks.sendSmsOtp }));
vi.mock("@/lib/auth/session", () => ({
  createSession: mocks.createSession,
  setSessionCookie: mocks.setSessionCookie,
  destroySession: mocks.destroySession,
}));

import { POST as sendOtp } from "@/app/api/auth/send-otp/route";
import { POST as verifyOtp } from "@/app/api/auth/verify-otp/route";
import { POST as logout } from "@/app/api/auth/logout/route";

function jsonRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.9, 10.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

function malformedJsonRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(
    async (callback: (tx: unknown) => unknown) =>
      callback({
        otpCode: {
          findFirst: mocks.otpFindFirst,
          count: mocks.otpCount,
          create: mocks.otpCreate,
        },
      }),
  );
  mocks.otpFindFirst.mockResolvedValue(null);
  mocks.otpCount.mockResolvedValue(0);
  mocks.otpCreate.mockResolvedValue({ id: "otp-created" });
  mocks.otpUpdateMany.mockResolvedValue({ count: 1 });
  mocks.otpDelete.mockResolvedValue({});
  mocks.otpDeleteMany.mockResolvedValue({ count: 1 });
  mocks.sendSmsOtp.mockResolvedValue(undefined);
  mocks.createSession.mockResolvedValue({ token: "session-token" });
  mocks.setSessionCookie.mockResolvedValue(undefined);
  mocks.destroySession.mockResolvedValue(undefined);
});

describe("POST /api/auth/send-otp", () => {
  it("returns a Chinese 400 response for malformed JSON", async () => {
    const response = await sendOtp(malformedJsonRequest("/api/auth/send-otp"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "请求格式错误",
    });
  });

  it("sends and persists an OTP for a valid phone", async () => {
    const response = await sendOtp(
      jsonRequest("/api/auth/send-otp", { phone: "138 0013 8000" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.sendSmsOtp).toHaveBeenCalledWith(
      "13800138000",
      expect.stringMatching(/^\d{6}$/),
    );
    expect(mocks.otpCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: "13800138000",
        ip: "203.0.113.9",
      }),
    });
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("rejects an invalid phone without querying the database", async () => {
    const response = await sendOtp(
      jsonRequest("/api/auth/send-otp", { phone: "123" }),
    );

    expect(response.status).toBe(400);
    expect(mocks.otpFindFirst).not.toHaveBeenCalled();
  });

  it("deletes the reserved OTP and fails closed when SMS delivery fails", async () => {
    mocks.sendSmsOtp.mockRejectedValue(new Error("SMS unavailable"));

    const response = await sendOtp(
      jsonRequest("/api/auth/send-otp", { phone: "13800138000" }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "服务暂不可用",
    });
    expect(mocks.otpDelete).toHaveBeenCalledWith({
      where: { id: "otp-created" },
    });
  });
});

describe("POST /api/auth/verify-otp", () => {
  it("returns a Chinese 400 response for malformed JSON", async () => {
    const response = await verifyOtp(
      malformedJsonRequest("/api/auth/verify-otp"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "请求格式错误",
    });
  });

  it("creates a user session after a correct OTP", async () => {
    const code = "123456";
    mocks.otpFindFirst.mockResolvedValue({
      id: "otp-1",
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      codeHash: await hashOtp(code),
    });
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue({
      id: "user-1",
      phone: "13800138000",
      nickname: null,
      city: null,
      roleTag: null,
      isAdmin: false,
    });

    const response = await verifyOtp(
      jsonRequest("/api/auth/verify-otp", {
        phone: "13800138000",
        code,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      needsOnboarding: true,
    });
    expect(mocks.otpDelete).toHaveBeenCalledWith({ where: { id: "otp-1" } });
    expect(mocks.otpDeleteMany).not.toHaveBeenCalled();
    expect(mocks.createSession).toHaveBeenCalledWith("user-1");
    expect(mocks.setSessionCookie).toHaveBeenCalledWith("session-token");
  });

  it("increments attempts after an incorrect OTP", async () => {
    mocks.otpFindFirst.mockResolvedValue({
      id: "otp-1",
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      codeHash: await hashOtp("654321"),
    });
    const response = await verifyOtp(
      jsonRequest("/api/auth/verify-otp", {
        phone: "13800138000",
        code: "123456",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.otpUpdateMany).toHaveBeenCalledWith({
      where: { id: "otp-1", attempts: { lt: 5 } },
      data: { attempts: { increment: 1 } },
    });
    expect(mocks.otpUpdate).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("reports the attempt cap when a concurrent guess consumed the last attempt", async () => {
    mocks.otpFindFirst.mockResolvedValue({
      id: "otp-1",
      attempts: 4,
      expiresAt: new Date(Date.now() + 60_000),
      codeHash: await hashOtp("654321"),
    });
    mocks.otpUpdateMany.mockResolvedValue({ count: 0 });

    const response = await verifyOtp(
      jsonRequest("/api/auth/verify-otp", {
        phone: "13800138000",
        code: "123456",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "验证码错误次数过多",
    });
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("preserves older sends so a later send still counts them", async () => {
    const code = "123456";
    const older = {
      id: "otp-old",
      phone: "13800138000",
      ip: "203.0.113.9",
      attempts: 0,
      createdAt: new Date(Date.now() - 120_000),
      expiresAt: new Date(Date.now() + 60_000),
      codeHash: await hashOtp("654321"),
    };
    const matched = {
      ...older,
      id: "otp-new",
      createdAt: new Date(Date.now() - 90_000),
      codeHash: await hashOtp(code),
    };
    const rows = [older, matched];
    const observedCounts: number[] = [];
    mocks.otpFindFirst.mockImplementation(async () => rows.at(-1) ?? null);
    mocks.otpDelete.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        const index = rows.findIndex((row) => row.id === where.id);
        if (index >= 0) rows.splice(index, 1);
        return {};
      },
    );
    mocks.otpCount.mockImplementation(
      async ({ where }: { where: { phone?: string; ip?: string } }) => {
        const count = rows.filter(
          (row) =>
            (where.phone === undefined || row.phone === where.phone) &&
            (where.ip === undefined || row.ip === where.ip),
        ).length;
        observedCounts.push(count);
        return count;
      },
    );
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      phone: "13800138000",
      nickname: "测试用户",
      city: "上海",
      roleTag: "founder",
      isAdmin: false,
    });

    const verifyResponse = await verifyOtp(
      jsonRequest("/api/auth/verify-otp", {
        phone: "13800138000",
        code,
      }),
    );
    const sendResponse = await sendOtp(
      jsonRequest("/api/auth/send-otp", { phone: "13800138000" }),
    );

    expect(verifyResponse.status).toBe(200);
    expect(rows.map((row) => row.id)).toContain("otp-old");
    expect(sendResponse.status).toBe(200);
    expect(observedCounts).toEqual([1, 1]);
  });
});

describe("POST /api/auth/logout", () => {
  it("destroys the current session", async () => {
    const response = await logout();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.destroySession).toHaveBeenCalledOnce();
  });
});
