import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { refreshRecommendationsWithLlm } from "@/lib/ai/match";

/**
 * 重新生成推荐（手动刷新或前端后台触发）：
 * 规则评分 → LLM 理由 → 覆盖写入缓存；LLM 失败时保留规则文案。
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "请先登录" },
      { status: 401 },
    );
  }

  try {
    const { count } = await refreshRecommendationsWithLlm(user);
    return NextResponse.json({ ok: true, count });
  } catch {
    return NextResponse.json(
      { ok: false, error: "推荐生成失败，请稍后再试" },
      { status: 503 },
    );
  }
}
