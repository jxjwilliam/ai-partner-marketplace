import type { RoleTag, User } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { FILTER_CITIES } from "@/lib/constants";
import { prisma } from "@/lib/db";

const ROLE_TAGS: RoleTag[] = ["talent", "founder", "investor", "other"];

function safeUser(user: User) {
  return {
    id: user.id,
    phone: user.phone,
    nickname: user.nickname,
    city: user.city,
    roleTag: user.roleTag,
    bio: user.bio,
    isAdmin: user.isAdmin,
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true, user: safeUser(user) });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "请先登录" },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    const value: unknown = await req.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("invalid body");
    }
    body = value as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求格式错误" },
      { status: 400 },
    );
  }

  const nickname = String(body.nickname ?? "").trim().slice(0, 32);
  const city = String(body.city ?? "");
  const roleTag = String(body.roleTag ?? "") as RoleTag;
  const bio =
    body.bio == null ? undefined : String(body.bio).trim().slice(0, 200);

  if (
    !nickname ||
    !FILTER_CITIES.includes(city as (typeof FILTER_CITIES)[number])
  ) {
    return NextResponse.json(
      { ok: false, error: "请填写昵称和城市" },
      { status: 400 },
    );
  }
  if (!ROLE_TAGS.includes(roleTag)) {
    return NextResponse.json(
      { ok: false, error: "请选择身份" },
      { status: 400 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { nickname, city, roleTag, bio },
  });

  return NextResponse.json({ ok: true, user: safeUser(updated) });
}
