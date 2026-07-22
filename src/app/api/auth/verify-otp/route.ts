import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  assertCanVerifyOtp,
  normalizePhone,
  verifyOtpHash,
} from "@/lib/auth/otp";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { OTP_MAX_ATTEMPTS } from "@/lib/constants";

export async function POST(request: NextRequest) {
  let body: { phone?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求格式错误" },
      { status: 400 },
    );
  }
  const phone = normalizePhone(String(body.phone ?? ""));
  const code = String(body.code ?? "");
  if (!phone || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { ok: false, error: "验证码错误" },
      { status: 400 },
    );
  }

  const otp = await prisma.otpCode.findFirst({
    where: { phone },
    orderBy: { createdAt: "desc" },
  });
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
    const incremented = await prisma.otpCode.updateMany({
      where: { id: otp.id, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          incremented.count === 0 ? "验证码错误次数过多" : "验证码错误",
      },
      { status: 400 },
    );
  }

  await prisma.otpCode.delete({ where: { id: otp.id } });

  const adminPhones = (process.env.ADMIN_PHONES || "")
    .split(",")
    .map((value) => value.trim());
  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({
      data: { phone, isAdmin: adminPhones.includes(phone) },
    });
  }

  const { token } = await createSession(user.id);
  await setSessionCookie(token);

  const needsOnboarding = !user.nickname || !user.city || !user.roleTag;
  return NextResponse.json({ ok: true, needsOnboarding });
}
