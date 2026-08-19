"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import RefreshRecommendations from "@/components/RefreshRecommendations";
import {
  apiFetch,
  clearClientToken,
  getClientToken,
} from "@/lib/auth/client-session";
import { POST_TYPE_LABEL } from "@/lib/constants";
import type { PostType } from "@/lib/types";

type RecommendationCard = {
  post: {
    id: string;
    type: PostType;
    title: string;
    city: string;
  } | null;
  score: number;
  reason: string;
};

type PageResponse = {
  ok?: boolean;
  error?: string;
  recommendations?: RecommendationCard[];
  hasMore?: boolean;
  llmReady?: boolean;
};

const PAGE_SIZE = 5;

export default function RecommendationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<RecommendationCard[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const autoRefreshed = useRef(false);

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const res = await apiFetch(
          `/api/recommendations?limit=${PAGE_SIZE}&page=${nextPage}`,
        );
        if (!res.ok) {
          if (res.status === 401) {
            clearClientToken();
            router.replace("/login?next=/recommendations");
            return undefined;
          }
          setError("推荐暂不可用，请稍后再试");
          return undefined;
        }
        const body = (await res.json()) as PageResponse;
        setItems((prev) =>
          append
            ? [...prev, ...(body.recommendations ?? [])]
            : (body.recommendations ?? []),
        );
        setHasMore(Boolean(body.hasMore));
        setPage(nextPage);
        return body;
      } catch {
        setError("网络连接失败，请稍后重试");
        return undefined;
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [router],
  );

  // 首屏：秒出缓存/规则结果；若没有 AI 理由，后台生成一次并自动刷新。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getClientToken()) {
        router.replace("/login?next=/recommendations");
        return;
      }
      const body = await load(1, false);
      if (cancelled || !body || body.llmReady) return;
      if (autoRefreshed.current) return;
      autoRefreshed.current = true;
      setHint("AI 理由生成中…当前展示规则匹配结果");
      try {
        const res = await apiFetch("/api/recommendations/refresh", {
          method: "POST",
        });
        if (res.ok && !cancelled) await load(1, false);
      } catch {
        // 后台生成失败不打扰用户，可手动刷新
      } finally {
        if (!cancelled) setHint("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, router]);

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    try {
      const res = await apiFetch("/api/recommendations/refresh", {
        method: "POST",
      });
      if (res.ok) await load(1, false);
      else setError("推荐生成失败，请稍后再试");
    } catch {
      setError("网络连接失败，请稍后重试");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-cyan-600">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            AI 匹配
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1F3A5F]">
            为你推荐
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            基于技能、城市与身份画像；结果缓存 30 分钟，首屏秒出
          </p>
        </div>
        <RefreshRecommendations
          onRefresh={() => void handleRefresh()}
          refreshing={refreshing}
        />
      </div>

      {hint && (
        <p className="mt-4 flex items-center gap-1.5 rounded-xl bg-cyan-50 px-3 py-2 text-xs text-cyan-700">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {hint}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}

      <section className="mt-6 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
              key={index}
            >
              <div className="h-3 w-32 rounded bg-slate-100" />
              <div className="mt-3 h-5 w-3/4 rounded bg-slate-100" />
              <div className="mt-2 h-3 w-full rounded bg-slate-100" />
            </div>
          ))
        ) : items.length ? (
          items.map((item, index) =>
            item.post ? (
              <Link
                className="group block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-cyan-400 hover:shadow-md sm:p-5"
                href={`/posts/${item.post.id}`}
                key={item.post.id}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-cyan-50 px-2 py-0.5 font-semibold text-cyan-700">
                    {POST_TYPE_LABEL[item.post.type]}
                  </span>
                  <span>{item.post.city}</span>
                  <span className="ml-auto">匹配度 {item.score}</span>
                </div>
                <h2 className="mt-2 text-base font-semibold text-[#1F3A5F] transition group-hover:text-cyan-700">
                  {index + 1}. {item.post.title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  💡 {item.reason}
                </p>
              </Link>
            ) : null,
          )
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            还没有足够资料生成推荐，去
            <Link className="mx-1 text-cyan-600 hover:underline" href="/onboarding">
              完善资料
            </Link>
            或先
            <Link className="mx-1 text-cyan-600 hover:underline" href="/posts/new">
              发布信息
            </Link>
            。
          </div>
        )}
      </section>

      {!loading && hasMore && (
        <div className="mt-6 text-center">
          <button
            className="inline-block rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-[#1F3A5F] transition hover:border-cyan-400 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loadingMore}
            onClick={() => void load(page + 1, true)}
            type="button"
          >
            {loadingMore ? "加载中…" : "加载更多"}
          </button>
        </div>
      )}
    </main>
  );
}
