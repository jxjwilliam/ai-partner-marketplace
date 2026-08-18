import Link from "next/link";
import FilterBar from "@/components/FilterBar";
import PostCard from "@/components/PostCard";
import RecommendedPosts, {
  type RecommendedItem,
} from "@/components/RecommendedPosts";
import SearchBox from "@/components/SearchBox";
import SortSelect from "@/components/SortSelect";
import { getSessionUser } from "@/lib/auth/session";
import { recommendForUser } from "@/lib/ai/match";
import { AI_HOMEPAGE_TIMEOUT_MS } from "@/lib/constants";
import { countPostsByType, getPostsByIds, listPosts } from "@/lib/data";
import { POST_TYPE_LABEL } from "@/lib/constants";
import {
  buildPostWhere,
  isPostSort,
} from "@/lib/posts/filters";

type HomeProps = {
  searchParams: Promise<{
    city?: string | string[];
    type?: string | string[];
    tags?: string | string[];
    q?: string | string[];
    sort?: string | string[];
    page?: string | string[];
  }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const CATEGORY_ICONS: Record<string, string> = {
  partner: "🤝",
  talent: "🧑‍💻",
  project: "💼",
  funding: "💰",
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const city = first(params.city);
  const type = first(params.type) ?? "all";
  const search = first(params.q) ?? "";
  const rawSort = first(params.sort) ?? "";
  const sort = isPostSort(rawSort) ? rawSort : "latest";
  const page = Math.max(1, Number(first(params.page)) || 1);
  const tags = (first(params.tags) ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const where = buildPostWhere({ city, type, tags, search });
  const [result, counts] = await Promise.all([
    listPosts({ ...where, sort, page }),
    countPostsByType(),
  ]);
  const { posts: visiblePosts, hasMore } = result;

  const user = await getSessionUser();
  let recommendations: RecommendedItem[] = [];
  if (user) {
    try {
      const recs = await recommendForUser(user, 3, {
        llmTimeoutMs: AI_HOMEPAGE_TIMEOUT_MS,
      });
      const posts = await getPostsByIds(recs.map((item) => item.postId));
      const byId = new Map(posts.map((post) => [post.id, post]));
      recommendations = recs.map((item) => ({
        post: byId.get(item.postId) ?? null,
        score: item.score,
        reason: item.reason,
      }));
    } catch {
      recommendations = [];
    }
  }

  function listHref(next: {
    type?: string;
    sort?: string;
    page?: number;
  }) {
    const url = new URLSearchParams();
    if (city && city !== "全部") url.set("city", city);
    const nextType = next.type ?? type;
    if (nextType !== "all") url.set("type", nextType);
    if (tags.length) url.set("tags", tags.join(","));
    if (search.trim()) url.set("q", search.trim());
    const nextSort = next.sort ?? sort;
    if (nextSort !== "latest") url.set("sort", nextSort);
    const nextPage = next.page ?? page;
    if (nextPage > 1) url.set("page", String(nextPage));
    return url.toString() ? `/?${url.toString()}` : "/";
  }

  const filterParams = {
    city: city && city !== "全部" ? city : "",
    type: type !== "all" ? type : "",
    tags: tags.join(","),
  };

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <p className="text-sm font-semibold tracking-wide text-cyan-600">
            AI合伙人集市
          </p>
          <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-[#1F3A5F] sm:text-4xl">
            找到能一起把事情做成的人
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">
            连接资深技术人、创业项目与投资资本 —— 高效对接商业机会，平台只做信息撮合。
          </p>
          <div className="mt-6">
            <SearchBox defaultValue={search} filters={filterParams} />
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {/* Category cards */}
        <section
          aria-label="分类入口"
          className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {Object.keys(POST_TYPE_LABEL).map((key) => {
            const active = type === key;
            const count = counts[key as keyof typeof counts] ?? 0;
            return (
              <Link
                className={`rounded-2xl border-2 p-5 text-center transition ${
                  active
                    ? "border-cyan-500 bg-cyan-50/60 shadow-sm"
                    : "border-slate-200 bg-white hover:border-cyan-400/60 hover:shadow-sm"
                }`}
                href={listHref({ type: active ? "all" : key, page: 1 })}
                key={key}
              >
                <div className="text-2xl">{CATEGORY_ICONS[key]}</div>
                <div className="mt-2 text-sm font-semibold text-[#1F3A5F]">
                  {POST_TYPE_LABEL[key]}
                </div>
                <div className="mt-1 text-xs text-slate-400">{count} 条</div>
              </Link>
            );
          })}
        </section>

        <RecommendedPosts items={recommendations} />

        <FilterBar city={city} type={type} tags={tags} search={search} sort={sort} page={page} />

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-[#1F3A5F]">
              {search.trim()
                ? `“${search.trim()}” 的搜索结果（${visiblePosts.length}）`
                : `最新合作信息（${visiblePosts.length}）`}
            </h2>
            <SortSelect value={sort} filters={filterParams} page={page} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {visiblePosts.length ? (
              visiblePosts.map((post) => <PostCard key={post.id} post={post} />)
            ) : (
              <div className="px-6 py-16 text-center">
                <p className="text-slate-500">
                  {search.trim()
                    ? "没有找到匹配的信息，换个关键词试试"
                    : "暂无帖子，来发布第一条"}
                </p>
                <Link
                  className="mt-4 inline-block rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
                  href="/posts/new"
                >
                  立即发布
                </Link>
              </div>
            )}
          </div>

          {hasMore && (
            <div className="mt-6 text-center">
              <Link
                className="inline-block rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-[#1F3A5F] transition hover:border-cyan-400 hover:text-cyan-700"
                href={listHref({ page: page + 1 })}
              >
                加载更多
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
