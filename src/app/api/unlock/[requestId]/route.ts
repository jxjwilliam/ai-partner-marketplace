import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { nextUnlockStatus } from "@/lib/unlock/state";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

function error(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return error("请先登录", 401);

  let action: "approve" | "reject";
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return error("请求格式错误", 400);
    }
    const value = (body as Record<string, unknown>).action;
    if (value !== "approve" && value !== "reject") {
      return error("操作无效", 400);
    }
    action = value;
  } catch {
    return error("请求格式错误", 400);
  }

  const { requestId } = await context.params;
  const unlock = await prisma.contactRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      post: { select: { authorId: true } },
    },
  });
  if (!unlock) return error("申请不存在", 404);
  if (unlock.post.authorId !== user.id) return error("无权处理此申请", 403);

  let status: "approved" | "rejected";
  try {
    status = nextUnlockStatus(unlock.status, action);
  } catch {
    return error("申请已处理", 409);
  }

  const updated = await prisma.contactRequest.update({
    where: { id: requestId },
    data: { status, decidedAt: new Date() },
    select: { id: true, status: true },
  });
  return NextResponse.json({ ok: true, request: updated });
}
