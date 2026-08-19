"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  MessageSquare,
  PenSquare,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useSessionUser } from "@/lib/auth/use-session-user";
import { apiFetch } from "@/lib/auth/client-session";

let recommendationsPrefetched = false;
function prefetchRecommendations() {
  if (recommendationsPrefetched) return;
  recommendationsPrefetched = true;
  // 提前拉取并暖缓存（规则结果秒出），点进推荐页时直接命中。
  void apiFetch("/api/recommendations?limit=5&page=1").catch(
    () => undefined,
  );
}

export default function SiteHeader() {
  const { user, loading } = useSessionUser();
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#1F3A5F] transition hover:text-cyan-700"
          href="/"
        >
          <svg
            aria-hidden="true"
            className="h-7 w-7 rounded-lg bg-[#1F3A5F] p-1 text-cyan-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              d="M17 8a3 3 0 10-2.83-2M8 16a3 3 0 102.83 2M7 7l10 10M7 17l10-10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          AI合伙人集市
        </Link>
        <nav
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 sm:gap-2"
          aria-label="主导航"
        >
          <Link
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition ${
              isActive("/", true)
                ? "bg-[#1F3A5F]/10 font-semibold text-[#1F3A5F]"
                : "text-slate-600 hover:bg-slate-100 hover:text-[#1F3A5F]"
            }`}
            href="/"
          >
            <Compass className="h-4 w-4" aria-hidden="true" />
            浏览
          </Link>
          <Link
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition ${
              isActive("/posts/new", false)
                ? "bg-[#1F3A5F]/10 font-semibold text-[#1F3A5F]"
                : "text-slate-600 hover:bg-slate-100 hover:text-[#1F3A5F]"
            }`}
            href="/posts/new"
          >
            <PenSquare className="h-4 w-4" aria-hidden="true" />
            发布
          </Link>
          <Link
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition ${
              isActive("/community", true)
                ? "bg-[#1F3A5F]/10 font-semibold text-[#1F3A5F]"
                : "text-slate-600 hover:bg-slate-100 hover:text-[#1F3A5F]"
            }`}
            href="/community"
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            社区
          </Link>
          {user && (
            <Link
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition ${
                isActive("/recommendations", true)
                  ? "bg-[#1F3A5F]/10 font-semibold text-[#1F3A5F]"
                  : "text-slate-600 hover:bg-slate-100 hover:text-[#1F3A5F]"
              }`}
              href="/recommendations"
              onMouseEnter={prefetchRecommendations}
              onFocus={prefetchRecommendations}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              推荐
            </Link>
          )}
          <Link
            className="flex max-w-44 items-center gap-1.5 truncate rounded-lg bg-[#1F3A5F] px-3 py-2 text-white transition hover:bg-cyan-600"
            href={user ? "/me" : "/login"}
            title={user ? (user.phone ?? user.email ?? "个人中心") : "登录"}
          >
            <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
            {loading
              ? "…"
              : user
                ? (user.phone ?? user.email ?? user.nickname ?? "我的")
                : "登录"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
