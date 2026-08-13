import { NextRequest, NextResponse } from "next/server";
import {
  assertCanSendOtp,
  generateOtpCode,
  hashOtp,
  normalizePhone,
} from "@/lib/auth/otp";
import { sendSmsOtp } from "@/lib/auth/sms";
import {
  countOtpCreatedSince,
  createOtpRow,
  deleteOtpRow,
  findLatestOtp,
} from "@/lib/data";
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

  try {
    const [last, sendsPhoneToday, sendsIpToday] = await Promise.all([
      findLatestOtp(phone),
      countOtpCreatedSince("phone", phone, dayStart),
      countOtpCreatedSince("ip", ip, dayStart),
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

    const otp = await createOtpRow({
      phone,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      ip,
    });

    try {
      await sendSmsOtp(phone, code);
    } catch {
      await deleteOtpRow(otp.id).catch(() => undefined);
      return NextResponse.json(
        { ok: false, error: "服务暂不可用" },
        { status: 503 },
      );
    }

    // Local/dev only: real SMS is skipped when SMS_DRY_RUN=true.
    if (process.env.SMS_DRY_RUN === "true") {
      return NextResponse.json({ ok: true, dryRun: true, devCode: code });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "服务暂不可用" },
      { status: 503 },
    );
  }
}
