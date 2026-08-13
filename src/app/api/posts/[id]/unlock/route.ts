import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  countPendingUnlocksToday,
  createUnlockRequest,
  getPostAuthor,
  getUnlockStatus,
  reopenUnlockRequest,
} from "@/lib/data";
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
  const post = await getPostAuthor(postId);
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
  const [pendingToday, existingStatus] = await Promise.all([
    countPendingUnlocksToday(user.id, startOfToday),
    getUnlockStatus(postId, user.id),
  ]);

  const allowed = canCreateUnlockRequest({
    authorId: post.authorId,
    requesterId: user.id,
    message,
    pendingToday,
    existingStatus,
    postStatus: post.status,
  });
  if (!allowed.ok) return error(allowed.error, 400);

  const request =
    existingStatus === "rejected"
      ? await reopenUnlockRequest(postId, user.id, message)
      : await createUnlockRequest(postId, user.id, message);

  return NextResponse.json({
    ok: true,
    request: { id: request.id, status: request.status },
  });
}
