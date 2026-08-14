"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function RecommendationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<RecommendationCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getClientToken()) {
        router.replace("/login?next=/recommendations");
        return;
      }
      const refresh =
        new URLSearchParams(window.location.search).get("refresh") === "1";
      const res = await apiFetch(
        `/api/recommendations?limit=5${refresh ? "&refresh=1" : ""}`,
      );
      if (cancelled) return;
      if (!res.ok) {
        clearClientToken();
        router.replace("/login?next=/recommendations");
        return;
      }
      const body = (await res.json()) as {
        recommendations?: RecommendationCard[];
      };
      setItems(body.recommendations ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-cyan-600">AI 匹配</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1F3A5F]">
            为你推荐
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            基于技能、城市与身份画像；30 分钟内结果相同，可手动刷新
          </p>
        </div>
        <RefreshRecommendations />
      </div>

      <section className="mt-6 space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            加载中…
          </div>
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
    </main>
  );
}
