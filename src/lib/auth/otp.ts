import { randomInt } from "crypto";

import bcrypt from "bcryptjs";
import {
  OTP_COOLDOWN_MS,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS_PER_IP_DAY,
  OTP_MAX_SENDS_PER_PHONE_DAY,
} from "@/lib/constants";

export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!/^1[3-9]\d{9}$/.test(digits)) return null;
  return digits;
}

export function generateOtpCode(): string {
  return String(randomInt(100000, 1000000));
}

export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function verifyOtpHash(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export function assertCanSendOtp(input: {
  lastSentAt: Date | null;
  sendsPhoneToday: number;
  sendsIpToday: number;
  now?: Date;
}): { ok: true } | { ok: false; error: string } {
  const now = input.now ?? new Date();
  if (input.lastSentAt && now.getTime() - input.lastSentAt.getTime() < OTP_COOLDOWN_MS) {
    return { ok: false, error: "发送太频繁，请稍后再试" };
  }
  if (input.sendsPhoneToday >= OTP_MAX_SENDS_PER_PHONE_DAY) {
    return { ok: false, error: "今日发送次数已达上限" };
  }
  if (input.sendsIpToday >= OTP_MAX_SENDS_PER_IP_DAY) {
    return { ok: false, error: "今日发送次数已达上限" };
  }
  return { ok: true };
}

export function assertCanVerifyOtp(input: {
  attempts: number;
  expiresAt: Date;
  now?: Date;
}): { ok: true } | { ok: false; error: string } {
  const now = input.now ?? new Date();
  if (now > input.expiresAt) return { ok: false, error: "验证码已过期" };
  if (input.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "验证码错误次数过多" };
  }
  return { ok: true };
}
