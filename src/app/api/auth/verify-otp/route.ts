import { NextRequest, NextResponse } from "next/server";
import {
  assertCanVerifyOtp,
  normalizePhone,
  verifyOtpHash,
} from "@/lib/auth/otp";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import {
  consumeOtpRow,
  createUser,
  findLatestOtp,
  getUserByPhone,
  incrementOtpAttempts,
} from "@/lib/data";
import { OTP_MAX_ATTEMPTS } from "@/lib/constants";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求格式错误" },
      { status: 400 },
    );
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "请求格式错误" },
      { status: 400 },
    );
  }
  const { phone: rawPhone, code: rawCode } = body as {
    phone?: unknown;
    code?: unknown;
  };
  const phone = normalizePhone(String(rawPhone ?? ""));
  const code = String(rawCode ?? "");
  if (!phone || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { ok: false, error: "验证码错误" },
      { status: 400 },
    );
  }

  const otp = await findLatestOtp(phone);
  if (!otp) {
    return NextResponse.json(
      { ok: false, error: "请先获取验证码" },
      { status: 400 },
    );
  }

  const gate = assertCanVerifyOtp({
    attempts: otp.attempts,
    expiresAt: otp.expiresAt,
  });
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: gate.error },
      { status: 400 },
    );
  }

  const match = await verifyOtpHash(code, otp.codeHash);
  if (!match) {
    const attempts = await incrementOtpAttempts(otp.id);
    return NextResponse.json(
      {
        ok: false,
        error:
          attempts >= OTP_MAX_ATTEMPTS ? "验证码错误次数过多" : "验证码错误",
      },
      { status: 400 },
    );
  }

  const consumed = await consumeOtpRow(otp.id);
  if (!consumed) {
    return NextResponse.json(
      {
        ok: false,
        error:
          otp.attempts >= OTP_MAX_ATTEMPTS - 1
            ? "验证码错误次数过多"
            : "验证码错误",
      },
      { status: 400 },
    );
  }

  const adminPhones = (process.env.ADMIN_PHONES || "")
    .split(",")
    .map((value) => value.trim());
  let user = await getUserByPhone(phone);
  if (!user) {
    user = await createUser({ phone, isAdmin: adminPhones.includes(phone) });
  }

  const { token } = await createSession(user.id);
  await setSessionCookie(token);

  const needsOnboarding = !user.nickname || !user.city || !user.roleTag;
  // Token is returned so clients can persist it in localStorage
  // (iframe-safe; the httpOnly cookie is still set for direct browsing).
  return NextResponse.json({ ok: true, token, needsOnboarding });
}
