import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hashOtp } from "@/lib/auth/otp";

const mocks = vi.hoisted(() => ({
  findLatestOtp: vi.fn(),
  countOtpCreatedSince: vi.fn(),
  createOtpRow: vi.fn(),
  deleteOtpRow: vi.fn(),
  incrementOtpAttempts: vi.fn(),
  consumeOtpRow: vi.fn(),
  getUserByPhone: vi.fn(),
  createUser: vi.fn(),
  sendSmsOtp: vi.fn(),
  createSession: vi.fn(),
  setSessionCookie: vi.fn(),
  destroySession: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  findLatestOtp: mocks.findLatestOtp,
  countOtpCreatedSince: mocks.countOtpCreatedSince,
  createOtpRow: mocks.createOtpRow,
  deleteOtpRow: mocks.deleteOtpRow,
  incrementOtpAttempts: mocks.incrementOtpAttempts,
  consumeOtpRow: mocks.consumeOtpRow,
  getUserByPhone: mocks.getUserByPhone,
  createUser: mocks.createUser,
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

function nullJsonBodyRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "null",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findLatestOtp.mockResolvedValue(null);
  mocks.countOtpCreatedSince.mockResolvedValue(0);
  mocks.createOtpRow.mockResolvedValue({ id: "otp-created" });
  mocks.incrementOtpAttempts.mockResolvedValue(1);
  mocks.consumeOtpRow.mockResolvedValue(true);
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

  it("returns a Chinese 400 response for a null JSON body", async () => {
    const response = await sendOtp(nullJsonBodyRequest("/api/auth/send-otp"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "请求格式错误",
    });
    expect(mocks.findLatestOtp).not.toHaveBeenCalled();
  });

  it("sends and persists an OTP for a valid phone", async () => {
    const response = await sendOtp(
      jsonRequest("/api/auth/send-otp", { phone: "138 0013 8000" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
    expect(mocks.sendSmsOtp).toHaveBeenCalledWith(
      "13800138000",
      expect.stringMatching(/^\d{6}$/),
    );
    expect(mocks.createOtpRow).toHaveBeenCalledWith({
      phone: "13800138000",
      codeHash: expect.any(String),
      expiresAt: expect.any(Date),
      ip: "203.0.113.9",
    });
    expect(mocks.countOtpCreatedSince).toHaveBeenCalledTimes(2);
  });

  it("rejects an invalid phone without querying the database", async () => {
    const response = await sendOtp(
      jsonRequest("/api/auth/send-otp", { phone: "123" }),
    );

    expect(response.status).toBe(400);
    expect(mocks.findLatestOtp).not.toHaveBeenCalled();
  });

  it("rejects when the per-phone daily limit is reached", async () => {
    mocks.countOtpCreatedSince.mockImplementation((column: string) =>
      Promise.resolve(column === "phone" ? 10 : 0),
    );
    const response = await sendOtp(
      jsonRequest("/api/auth/send-otp", { phone: "13800138000" }),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "今日发送次数已达上限",
    });
    expect(mocks.createOtpRow).not.toHaveBeenCalled();
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
    expect(mocks.deleteOtpRow).toHaveBeenCalledWith("otp-created");
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

  it("returns a Chinese 400 response for a null JSON body", async () => {
    const response = await verifyOtp(
      nullJsonBodyRequest("/api/auth/verify-otp"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "请求格式错误",
    });
    expect(mocks.findLatestOtp).not.toHaveBeenCalled();
  });

  it("creates a user session after a correct OTP", async () => {
    const code = "123456";
    mocks.findLatestOtp.mockResolvedValue({
      id: "otp-1",
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      codeHash: await hashOtp(code),
    });
    mocks.getUserByPhone.mockResolvedValue(null);
    mocks.createUser.mockResolvedValue({
      id: "user-1",
      phone: "13800138000",
      nickname: null,
      city: null,
      roleTag: null,
      bio: null,
      skills: [],
      yearsExperience: null,
      isVerified: false,
      isAdmin: false,
      createdAt: new Date(),
    });

    const response = await verifyOtp(
      jsonRequest("/api/auth/verify-otp", { phone: "13800138000", code }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      token: expect.any(String),
      needsOnboarding: true,
    });
    expect(mocks.consumeOtpRow).toHaveBeenCalledWith("otp-1");
    expect(mocks.createUser).toHaveBeenCalledWith({
      phone: "13800138000",
      isAdmin: false,
    });
    expect(mocks.createSession).toHaveBeenCalledWith("user-1");
  });

  it("skips onboarding for users who completed their profile", async () => {
    mocks.findLatestOtp.mockResolvedValue({
      id: "otp-1",
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      codeHash: await hashOtp("654321"),
    });
    mocks.getUserByPhone.mockResolvedValue({
      id: "user-1",
      phone: "13800138000",
      nickname: "小明",
      city: "上海",
      roleTag: "talent",
      bio: null,
      skills: [],
      yearsExperience: null,
      isVerified: false,
      isAdmin: false,
      createdAt: new Date(),
    });

    const response = await verifyOtp(
      jsonRequest("/api/auth/verify-otp", {
        phone: "13800138000",
        code: "654321",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      token: expect.any(String),
      needsOnboarding: false,
    });
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("counts failed attempts and returns Chinese errors", async () => {
    mocks.findLatestOtp.mockResolvedValue({
      id: "otp-1",
      attempts: 1,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      codeHash: await hashOtp("111111"),
    });

    const response = await verifyOtp(
      jsonRequest("/api/auth/verify-otp", {
        phone: "13800138000",
        code: "000000",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "验证码错误",
    });
    expect(mocks.incrementOtpAttempts).toHaveBeenCalledWith("otp-1");
  });

  it("locks the code after too many attempts", async () => {
    mocks.findLatestOtp.mockResolvedValue({
      id: "otp-1",
      attempts: 5,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      codeHash: await hashOtp("111111"),
    });

    const response = await verifyOtp(
      jsonRequest("/api/auth/verify-otp", {
        phone: "13800138000",
        code: "000000",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "验证码错误次数过多",
    });
  });
});

describe("POST /api/auth/logout", () => {
  it("destroys the session", async () => {
    const response = await logout(jsonRequest("/api/auth/logout", {}));

    expect(response.status).toBe(200);
    expect(mocks.destroySession).toHaveBeenCalledOnce();
  });
});
