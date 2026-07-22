import Link from "next/link";
import FilterBar from "@/components/FilterBar";
import PostCard from "@/components/PostCard";
import { prisma } from "@/lib/db";
import { buildPostWhere } from "@/lib/posts/filters";

type HomeProps = {
  searchParams: Promise<{
    city?: string | string[];
    type?: string | string[];
    tags?: string | string[];
  }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const city = first(params.city);
  const type = first(params.type) ?? "all";
  const tags = (first(params.tags) ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const posts = await prisma.post.findMany({
    where: buildPostWhere({ city, type, tags }),
    orderBy: { bumpedAt: "desc" },
    take: 100,
  });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-600">AI合伙人集市</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            找到能一起把事情做成的人
          </h1>
        </div>
        <Link
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          href="/posts/new"
        >
          发布合作信息
        </Link>
      </div>

      <FilterBar city={city} type={type} tags={tags} />

      <section className="mt-5 overflow-hidden border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-500">
          共 {posts.length} 条合作信息
        </div>
        {posts.length ? (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          <div className="px-6 py-16 text-center">
            <p className="text-slate-500">暂无帖子，来发布第一条</p>
            <Link
              className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
              href="/posts/new"
            >
              立即发布
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
