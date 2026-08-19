import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  RECOMMENDATIONS_PAGE_SIZE,
  listRecommendationItems,
} from "@/lib/ai/match";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "请先登录" },
      { status: 401 },
    );
  }

  const limit = Math.min(
    RECOMMENDATIONS_PAGE_SIZE,
    Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || RECOMMENDATIONS_PAGE_SIZE),
  );
  const page = Math.max(
    1,
    Number(req.nextUrl.searchParams.get("page")) || 1,
  );

  try {
    const { items, hasMore, llmReady } = await listRecommendationItems(
      user,
      page,
    );
    return NextResponse.json({
      ok: true,
      recommendations: items.slice(0, limit),
      hasMore,
      llmReady,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "推荐暂不可用，请稍后再试" },
      { status: 503 },
    );
  }
}
