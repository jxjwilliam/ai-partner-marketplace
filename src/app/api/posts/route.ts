import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createPost, listPosts } from "@/lib/data";
import {
  buildPostWhere,
  isPostSort,
  isValidPostFilterType,
} from "@/lib/posts/filters";
import { parsePostInput } from "@/lib/posts/schemas";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const type = params.get("type");
  if (type && !isValidPostFilterType(type)) {
    return NextResponse.json(
      { ok: false, error: "类型无效" },
      { status: 400 },
    );
  }

  const tags = params
    .get("tags")
    ?.split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const sortValue = params.get("sort") ?? "";
  const sort = isPostSort(sortValue) ? sortValue : "latest";
  const search = params.get("q") ?? undefined;
  const page = Math.max(1, Number(params.get("page")) || 1);

  const where = buildPostWhere({
    city: params.get("city") ?? undefined,
    type: type ?? undefined,
    tags,
    search,
  });
  const { posts, hasMore } = await listPosts({
    ...where,
    sort,
    page,
  });

  return NextResponse.json({ ok: true, posts, hasMore, page });
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
  const post = await createPost({
    ...fields,
    authorId: user.id,
    body,
  });

  return NextResponse.json({ ok: true, id: post.id });
}
