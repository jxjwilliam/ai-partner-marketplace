import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hashOtp } from "@/lib/auth/otp";

const mocks = vi.hoisted(() => ({
  otpFindFirst: vi.fn(),
  otpCount: vi.fn(),
  otpCreate: vi.fn(),
  otpUpdate: vi.fn(),
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
    otpCode: {
      findFirst: mocks.otpFindFirst,
      count: mocks.otpCount,
      create: mocks.otpCreate,
      update: mocks.otpUpdate,
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.otpFindFirst.mockResolvedValue(null);
  mocks.otpCount.mockResolvedValue(0);
  mocks.otpCreate.mockResolvedValue({});
  mocks.otpDeleteMany.mockResolvedValue({ count: 1 });
  mocks.sendSmsOtp.mockResolvedValue(undefined);
  mocks.createSession.mockResolvedValue({ token: "session-token" });
  mocks.setSessionCookie.mockResolvedValue(undefined);
  mocks.destroySession.mockResolvedValue(undefined);
});

describe("POST /api/auth/send-otp", () => {
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
  });

  it("rejects an invalid phone without querying the database", async () => {
    const response = await sendOtp(
      jsonRequest("/api/auth/send-otp", { phone: "123" }),
    );

    expect(response.status).toBe(400);
    expect(mocks.otpFindFirst).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/verify-otp", () => {
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
    expect(mocks.otpDeleteMany).toHaveBeenCalledWith({
      where: { phone: "13800138000" },
    });
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
    mocks.otpUpdate.mockResolvedValue({});

    const response = await verifyOtp(
      jsonRequest("/api/auth/verify-otp", {
        phone: "13800138000",
        code: "123456",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.otpUpdate).toHaveBeenCalledWith({
      where: { id: "otp-1" },
      data: { attempts: { increment: 1 } },
    });
    expect(mocks.createSession).not.toHaveBeenCalled();
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
