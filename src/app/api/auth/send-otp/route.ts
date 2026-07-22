import { Prisma } from "@prisma/client";
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
  const phone = normalizePhone(
    String((body as { phone?: unknown }).phone ?? ""),
  );
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

  const code = generateOtpCode();
  const codeHash = await hashOtp(code);
  let reservation:
    | { ok: true; otpId: string }
    | { ok: false; error: string };
  try {
    reservation = await prisma.$transaction(
      async (tx) => {
        const [last, sendsPhoneToday, sendsIpToday] = await Promise.all([
          tx.otpCode.findFirst({
            where: { phone },
            orderBy: { createdAt: "desc" },
          }),
          tx.otpCode.count({
            where: { phone, createdAt: { gte: dayStart } },
          }),
          tx.otpCode.count({
            where: { ip, createdAt: { gte: dayStart } },
          }),
        ]);
        const gate = assertCanSendOtp({
          lastSentAt: last?.createdAt ?? null,
          sendsPhoneToday,
          sendsIpToday,
        });
        if (!gate.ok) return gate;

        const otp = await tx.otpCode.create({
          data: {
            phone,
            codeHash,
            expiresAt: new Date(Date.now() + OTP_TTL_MS),
            ip,
          },
        });
        return { ok: true as const, otpId: otp.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "服务暂不可用" },
      { status: 503 },
    );
  }

  if (!reservation.ok) {
    return NextResponse.json(
      { ok: false, error: reservation.error },
      { status: 429 },
    );
  }

  try {
    await sendSmsOtp(phone, code);
  } catch {
    await prisma.otpCode
      .delete({ where: { id: reservation.otpId } })
      .catch(() => undefined);
    return NextResponse.json(
      { ok: false, error: "服务暂不可用" },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
