import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getPostsByIds } from "@/lib/data";
import { recommendForUser } from "@/lib/ai/match";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "请先登录" },
      { status: 401 },
    );
  }

  const limit = Math.min(
    5,
    Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 3),
  );

  try {
    const recommendations = await recommendForUser(user, limit);
    const posts = await getPostsByIds(
      recommendations.map((item) => item.postId),
    );
    const byId = new Map(posts.map((post) => [post.id, post]));
    const items = recommendations
      .map((item) => ({
        post: byId.get(item.postId) ?? null,
        score: item.score,
        reason: item.reason,
      }))
      .filter((item) => item.post !== null);
    return NextResponse.json({ ok: true, recommendations: items });
  } catch {
    return NextResponse.json(
      { ok: false, error: "推荐暂不可用，请稍后再试" },
      { status: 503 },
    );
  }
}
