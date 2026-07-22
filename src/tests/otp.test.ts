import { describe, expect, it } from "vitest";
import {
  normalizePhone,
  assertCanSendOtp,
  assertCanVerifyOtp,
  generateOtpCode,
} from "@/lib/auth/otp";

describe("normalizePhone", () => {
  it("accepts 11-digit CN mobile", () => {
    expect(normalizePhone("13812345678")).toBe("13812345678");
    expect(normalizePhone(" 138-1234-5678 ")).toBe("13812345678");
  });
  it("rejects invalid", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("12812345678")).toBeNull();
  });
});

describe("assertCanSendOtp", () => {
  const now = new Date("2026-07-21T12:00:00Z");
  it("blocks cooldown", () => {
    const r = assertCanSendOtp({
      lastSentAt: new Date("2026-07-21T11:59:30Z"),
      sendsPhoneToday: 0,
      sendsIpToday: 0,
      now,
    });
    expect(r).toEqual({ ok: false, error: "发送太频繁，请稍后再试" });
  });
  it("blocks phone daily cap", () => {
    const r = assertCanSendOtp({
      lastSentAt: null,
      sendsPhoneToday: 10,
      sendsIpToday: 0,
      now,
    });
    expect(r.ok).toBe(false);
  });
  it("allows when under limits", () => {
    const r = assertCanSendOtp({
      lastSentAt: new Date("2026-07-21T11:58:00Z"),
      sendsPhoneToday: 1,
      sendsIpToday: 1,
      now,
    });
    expect(r).toEqual({ ok: true });
  });
});

describe("assertCanVerifyOtp", () => {
  it("blocks expired", () => {
    const r = assertCanVerifyOtp({
      attempts: 0,
      expiresAt: new Date("2026-07-21T11:00:00Z"),
      now: new Date("2026-07-21T12:00:00Z"),
    });
    expect(r).toEqual({ ok: false, error: "验证码已过期" });
  });
  it("blocks too many attempts", () => {
    const r = assertCanVerifyOtp({
      attempts: 5,
      expiresAt: new Date("2026-07-21T13:00:00Z"),
      now: new Date("2026-07-21T12:00:00Z"),
    });
    expect(r).toEqual({ ok: false, error: "验证码错误次数过多" });
  });
});

describe("generateOtpCode", () => {
  it("returns 6 digits", () => {
    expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });
});
