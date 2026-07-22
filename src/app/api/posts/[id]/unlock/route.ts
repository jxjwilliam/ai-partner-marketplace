import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { canCreateUnlockRequest } from "@/lib/unlock/state";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function error(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return error("请先登录", 401);

  const { id: postId } = await context.params;
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, status: true },
  });
  if (!post) return error("信息不存在", 404);

  let message: string;
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return error("请求格式错误", 400);
    }
    message = String((body as Record<string, unknown>).message ?? "").trim();
  } catch {
    return error("请求格式错误", 400);
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [pendingToday, existing] = await Promise.all([
    prisma.contactRequest.count({
      where: {
        requesterId: user.id,
        status: "pending",
        createdAt: { gte: startOfToday },
      },
    }),
    prisma.contactRequest.findUnique({
      where: {
        postId_requesterId: { postId, requesterId: user.id },
      },
      select: { id: true, status: true },
    }),
  ]);

  const allowed = canCreateUnlockRequest({
    authorId: post.authorId,
    requesterId: user.id,
    message,
    pendingToday,
    existingStatus: existing?.status ?? null,
    postStatus: post.status,
  });
  if (!allowed.ok) return error(allowed.error, 400);

  const select = { id: true, status: true } as const;
  const unlock =
    existing?.status === "rejected"
      ? await prisma.contactRequest.upsert({
          where: {
            postId_requesterId: { postId, requesterId: user.id },
          },
          create: { postId, requesterId: user.id, message },
          // The unique row is intentionally reopened so a rejected requester
          // can submit a revised introduction without creating duplicates.
          update: {
            message,
            status: "pending",
            decidedAt: null,
            createdAt: new Date(),
          },
          select,
        })
      : await prisma.contactRequest.create({
          data: { postId, requesterId: user.id, message },
          select,
        });

  return NextResponse.json({ ok: true, request: unlock });
}
