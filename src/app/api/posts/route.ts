import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { buildPostWhere } from "@/lib/posts/filters";
import { parsePostInput } from "@/lib/posts/schemas";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const tags = params
    .get("tags")
    ?.split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const posts = await prisma.post.findMany({
    where: buildPostWhere({
      city: params.get("city") ?? undefined,
      type: params.get("type") ?? undefined,
      tags,
    }),
    orderBy: { bumpedAt: "desc" },
    include: {
      author: {
        select: { id: true, nickname: true, city: true, roleTag: true },
      },
    },
    take: 50,
  });

  return NextResponse.json({
    ok: true,
    posts: posts.map(({ contactPrivate, ...post }) => {
      void contactPrivate;
      return post;
    }),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "请先登录" },
      { status: 401 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求格式错误" },
      { status: 400 },
    );
  }

  const parsed = parsePostInput(raw);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.error },
      { status: 400 },
    );
  }

  const { body, ...fields } = parsed.data;
  const post = await prisma.post.create({
    data: {
      ...fields,
      authorId: user.id,
      bodyJson: body as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: post.id });
}
