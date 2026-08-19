import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Lock,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import FilterBar from "@/components/FilterBar";
import PostCard from "@/components/PostCard";
import RecommendedPosts from "@/components/RecommendedPosts";
import SearchBox from "@/components/SearchBox";
import SortSelect from "@/components/SortSelect";
import { getSessionUser } from "@/lib/auth/session";
import { recommendForHome, type HomeRecommendation } from "@/lib/ai/match";
import { listPosts } from "@/lib/data";
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
  const [user, result] = await Promise.all([
    getSessionUser(),
    listPosts({ ...where, sort, page }),
  ]);
  const { posts: visiblePosts, hasMore } = result;

  let recommendations: HomeRecommendation[] = [];
  if (user) {
    try {
      recommendations = await recommendForHome(user, 3);
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
          <p className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-cyan-600">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            AI合伙人集市
          </p>
          <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-[#1F3A5F] sm:text-4xl">
            找到能一起把事情做成的人
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">
            连接 10 年+ 资深技术人、AI 创业项目与投资方 ——
            找合伙人、接项目、融资金。平台只做信息撮合，联系方式按需解锁。
          </p>
          <div className="mt-6">
            <SearchBox defaultValue={search} filters={filterParams} />
          </div>
          <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
            <Link
              aria-label="我是资深专业人士，浏览找合伙人机会"
              className="group rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm transition hover:border-cyan-400 hover:shadow-md"
              href="/?type=partner"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1F3A5F]">
                <UserRound className="h-4 w-4 text-cyan-600" aria-hidden="true" />
                我是资深专业人士
                <ArrowRight
                  aria-hidden="true"
                  className="ml-auto h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-cyan-600"
                />
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                展示 10 年+ 履历与技能，找合伙人、接项目；联系方式由你掌控，对方申请后按需解锁。
              </p>
              <p className="mt-3 text-xs font-semibold text-cyan-600">
                浏览找合伙人机会 →
              </p>
            </Link>
            <Link
              aria-label="我是企业或投资人，查找资深人才"
              className="group rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm transition hover:border-cyan-400 hover:shadow-md"
              href="/?type=talent"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1F3A5F]">
                <Building2 className="h-4 w-4 text-cyan-600" aria-hidden="true" />
                我是企业 / 投资人
                <ArrowRight
                  aria-hidden="true"
                  className="ml-auto h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-cyan-600"
                />
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                按技能、城市、类型精准筛选资深人才与真实项目，申请解锁后直接对接。
              </p>
              <p className="mt-3 text-xs font-semibold text-cyan-600">
                查找资深人才 →
              </p>
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              手机号验证登录
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              联系方式申请解锁
            </span>
            <span className="flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              平台只做信息撮合
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">

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
