import { NextRequest, NextResponse } from "next/server";
import { polishFields } from "@/lib/ai/polish";
import { getSessionUser } from "@/lib/auth/session";

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "请先登录" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求格式错误" },
      { status: 400 },
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { type?: unknown }).type !== "string" ||
    !isStringRecord((body as { fields?: unknown }).fields)
  ) {
    return NextResponse.json(
      { ok: false, error: "请求格式错误" },
      { status: 400 },
    );
  }

  const { type, fields } = body as {
    type: string;
    fields: Record<string, string>;
  };

  try {
    const polished = await polishFields(type, fields);
    return NextResponse.json({ ok: true, fields: polished });
  } catch {
    return NextResponse.json(
      { ok: false, error: "润色暂不可用" },
      { status: 503 },
    );
  }
}
