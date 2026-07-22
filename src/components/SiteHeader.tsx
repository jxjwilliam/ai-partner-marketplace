import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";

export default async function SiteHeader() {
  const user = await getSessionUser();

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link
          className="font-bold tracking-tight text-slate-950 transition hover:text-indigo-600"
          href="/"
        >
          AI合伙人集市
        </Link>
        <nav
          className="flex items-center gap-5 text-sm font-medium text-slate-600"
          aria-label="主导航"
        >
          <Link className="transition hover:text-slate-950" href="/">
            浏览
          </Link>
          <Link className="transition hover:text-slate-950" href="/posts/new">
            发布
          </Link>
          <Link
            className="rounded-lg bg-slate-950 px-3 py-2 text-white transition hover:bg-indigo-600"
            href={user ? "/me" : "/login"}
          >
            {user ? user.nickname || "我的" : "登录"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
