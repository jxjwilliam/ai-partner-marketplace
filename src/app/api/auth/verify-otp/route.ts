import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  assertCanVerifyOtp,
  normalizePhone,
  verifyOtpHash,
} from "@/lib/auth/otp";
import { createSession, setSessionCookie } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const body = await request.json();
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
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json(
      { ok: false, error: "验证码错误" },
      { status: 400 },
    );
  }

  await prisma.otpCode.deleteMany({ where: { phone } });

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
