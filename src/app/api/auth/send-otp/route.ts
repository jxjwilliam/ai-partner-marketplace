import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  assertCanSendOtp,
  generateOtpCode,
  hashOtp,
  normalizePhone,
} from "@/lib/auth/otp";
import { sendSmsOtp } from "@/lib/auth/sms";
import { OTP_TTL_MS } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const phone = normalizePhone(String(body.phone ?? ""));
  if (!phone) {
    return NextResponse.json(
      { ok: false, error: "手机号格式不正确" },
      { status: 400 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [last, sendsPhoneToday, sendsIpToday] = await Promise.all([
    prisma.otpCode.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
    }),
    prisma.otpCode.count({
      where: { phone, createdAt: { gte: dayStart } },
    }),
    prisma.otpCode.count({
      where: { ip, createdAt: { gte: dayStart } },
    }),
  ]);

  const gate = assertCanSendOtp({
    lastSentAt: last?.createdAt ?? null,
    sendsPhoneToday,
    sendsIpToday,
  });
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: gate.error },
      { status: 429 },
    );
  }

  const code = generateOtpCode();
  try {
    await sendSmsOtp(phone, code);
  } catch {
    return NextResponse.json(
      { ok: false, error: "服务暂不可用" },
      { status: 503 },
    );
  }

  await prisma.otpCode.create({
    data: {
      phone,
      codeHash: await hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      ip,
    },
  });

  return NextResponse.json({ ok: true });
}
