"use client";

import Link from "next/link";
import { useSessionUser } from "@/lib/auth/use-session-user";

export default function SiteHeader() {
  const { user, loading } = useSessionUser();

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
          className="flex items-center gap-5 text-sm font-medium text-slate-600"
          aria-label="主导航"
        >
          <Link className="transition hover:text-[#1F3A5F]" href="/">
            浏览
          </Link>
          <Link
            className="transition hover:text-[#1F3A5F]"
            href="/posts/new"
          >
            发布
          </Link>
          {user && (
            <Link
              className="transition hover:text-[#1F3A5F]"
              href="/recommendations"
            >
              推荐
            </Link>
          )}
          <Link
            className="rounded-lg bg-[#1F3A5F] px-3 py-2 text-white transition hover:bg-cyan-600"
            href={user ? "/me" : "/login"}
          >
            {loading
              ? "…"
              : user
                ? user.nickname || "我的"
                : "登录"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
