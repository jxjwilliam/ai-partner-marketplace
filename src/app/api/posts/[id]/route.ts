import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  getPostAuthor,
  getPostById,
  getUnlockStatus,
  incrementPostViews,
  updatePostStatusOrBump,
} from "@/lib/data";
import { shouldRevealContact } from "@/lib/posts/visibility";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function notFound() {
  return NextResponse.json(
    { ok: false, error: "信息不存在" },
    { status: 404 },
  );
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const viewer = await getSessionUser();
  const post = await getPostById(id);

  if (
    !post ||
    (post.status === "hidden" &&
      viewer?.id !== post.authorId &&
      !viewer?.isAdmin)
  ) {
    return notFound();
  }

  let unlockStatus: "pending" | "approved" | "rejected" | null = null;
  if (viewer && viewer.id !== post.authorId) {
    unlockStatus = await getUnlockStatus(post.id, viewer.id);
  }

  const reveal = shouldRevealContact({
    viewerId: viewer?.id ?? null,
    authorId: post.authorId,
    unlockStatus,
  });

  const viewCount = await incrementPostViews(post.id);
  const incrementedPost = { ...post, viewCount };
  if (reveal) {
    return NextResponse.json({ ok: true, post: incrementedPost });
  }

  const { contactPrivate, ...safePost } = incrementedPost;
  void contactPrivate;
  return NextResponse.json({ ok: true, post: safePost });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "请先登录" },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const post = await getPostAuthor(id);
  if (!post) return notFound();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求格式错误" },
      { status: 400 },
    );
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json(
      { ok: false, error: "请求格式错误" },
      { status: 400 },
    );
  }

  const input = raw as Record<string, unknown>;
  const hide = input.status === "hidden";
  const bump = input.bump === true;
  if ((!hide && !bump) || (input.status !== undefined && !hide)) {
    return NextResponse.json(
      { ok: false, error: "没有可更新的内容" },
      { status: 400 },
    );
  }

  const isAuthor = post.authorId === user.id;
  if (bump && !isAuthor) {
    return NextResponse.json(
      { ok: false, error: "无权修改此信息" },
      { status: 403 },
    );
  }
  if (hide && !isAuthor && !user.isAdmin) {
    return NextResponse.json(
      { ok: false, error: "无权修改此信息" },
      { status: 403 },
    );
  }

  await updatePostStatusOrBump(id, { hide, bump });
  return NextResponse.json({ ok: true });
}
