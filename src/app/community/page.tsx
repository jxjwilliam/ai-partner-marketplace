import Link from "next/link";
import { MessagesSquare, ShieldCheck } from "lucide-react";
import CommunityComposer from "@/components/CommunityComposer";
import CommunityPostCard from "@/components/CommunityPostCard";
import { getSessionUser } from "@/lib/auth/session";
import { listCommunityPosts } from "@/lib/data";

type CommunityPageProps = {
  searchParams: Promise<{ page?: string | string[] }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CommunityPage({
  searchParams,
}: CommunityPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(first(params.page)) || 1);

  const [user, result] = await Promise.all([
    getSessionUser(),
    listCommunityPosts({ page }),
  ]);
  const { posts, hasMore } = result;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <section>
        <p className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-cyan-600">
          <MessagesSquare className="h-4 w-4" aria-hidden="true" />
          社区动态
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#1F3A5F] sm:text-3xl">
          资深技术人的交流区
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          分享踩坑经验、找队友、晒作品，或者抛出一个想聊的问题。
          找合伙人与项目请用上方的「发布」；评论区会自动隐藏手机号、邮箱和微信号。
        </p>
      </section>

      <div className="mt-6">
        {user ? (
          <CommunityComposer />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-sm text-slate-600">
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              登录后即可发布动态、参与评论。
            </p>
            <Link
              className="rounded-lg bg-[#1F3A5F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600"
              href="/login?next=/community"
            >
              登录 / 注册
            </Link>
          </div>
        )}
      </div>

      <section className="mt-6 space-y-4" aria-label="动态列表">
        {posts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            还没有动态，来发第一条吧。
          </div>
        ) : (
          posts.map((post) => (
            <CommunityPostCard
              currentUserId={user?.id ?? null}
              key={post.id}
              loggedIn={Boolean(user)}
              post={post}
            />
          ))
        )}
      </section>

      {hasMore && (
        <div className="mt-6 text-center">
          <Link
            className="inline-block rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-[#1F3A5F] transition hover:border-cyan-400 hover:text-cyan-700"
            href={`/community?page=${page + 1}`}
          >
            加载更多
          </Link>
        </div>
      )}
    </main>
  );
}
