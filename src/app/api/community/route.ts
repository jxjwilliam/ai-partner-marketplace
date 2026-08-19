import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { sanitizeCommunityPost } from "@/lib/community/sanitize";
import { COMMUNITY_MAX_POSTS_PER_DAY } from "@/lib/constants";
import { countCommunityPostsSince, createCommunityPost } from "@/lib/data";

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "请先登录后再发布动态" },
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

  const text = sanitizeCommunityPost((body as { body?: unknown }).body);
  if (!text) {
    return NextResponse.json(
      { ok: false, error: "动态内容不能为空，且不超过 1000 字" },
      { status: 400 },
    );
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const postedToday = await countCommunityPostsSince(user.id, dayStart);
  if (postedToday >= COMMUNITY_MAX_POSTS_PER_DAY) {
    return NextResponse.json(
      { ok: false, error: "今日发布动态已达上限，明天再来吧" },
      { status: 429 },
    );
  }

  const created = await createCommunityPost(user.id, text);
  return NextResponse.json({ ok: true, id: created.id });
}
