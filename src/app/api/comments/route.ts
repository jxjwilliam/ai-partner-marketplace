import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { sanitizeComment } from "@/lib/community/sanitize";
import { COMMUNITY_MAX_COMMENTS_PER_DAY } from "@/lib/constants";
import {
  countCommentsSince,
  createComment,
  getCommunityPost,
  getPostAuthor,
} from "@/lib/data";

const TARGET_TYPES = ["community", "listing"] as const;
type TargetType = (typeof TARGET_TYPES)[number];

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "请先登录后再评论" },
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
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "请求格式错误" },
      { status: 400 },
    );
  }

  const targetType = String(
    (body as { targetType?: unknown }).targetType ?? "",
  ) as TargetType;
  const targetId = String(
    (body as { targetId?: unknown }).targetId ?? "",
  ).trim();
  const text = sanitizeComment((body as { body?: unknown }).body);

  if (!TARGET_TYPES.includes(targetType) || !targetId) {
    return NextResponse.json(
      { ok: false, error: "评论目标无效" },
      { status: 400 },
    );
  }
  if (!text) {
    return NextResponse.json(
      { ok: false, error: "评论内容不能为空，且不超过 500 字" },
      { status: 400 },
    );
  }

  if (targetType === "community") {
    const post = await getCommunityPost(targetId);
    if (!post || post.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "动态不存在或已删除" },
        { status: 404 },
      );
    }
  } else {
    const post = await getPostAuthor(targetId);
    if (!post || post.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "帖子不存在或已隐藏" },
        { status: 404 },
      );
    }
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const commentedToday = await countCommentsSince(user.id, dayStart);
  if (commentedToday >= COMMUNITY_MAX_COMMENTS_PER_DAY) {
    return NextResponse.json(
      { ok: false, error: "今日评论已达上限，明天再来吧" },
      { status: 429 },
    );
  }

  const created = await createComment({
    authorId: user.id,
    communityPostId: targetType === "community" ? targetId : undefined,
    listingPostId: targetType === "listing" ? targetId : undefined,
    body: text,
  });
  return NextResponse.json({ ok: true, id: created.id });
}
