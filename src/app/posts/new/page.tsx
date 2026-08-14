"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PostForm from "@/components/PostForm";
import {
  apiFetch,
  clearClientToken,
  getClientToken,
} from "@/lib/auth/client-session";
import type { User } from "@/lib/types";

export default function NewPostPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getClientToken()) {
        router.replace("/login?next=/posts/new");
        return;
      }
      const res = await apiFetch("/api/me");
      if (cancelled) return;
      if (!res.ok) {
        clearClientToken();
        router.replace("/login?next=/posts/new");
        return;
      }
      const data = (await res.json()) as { user?: User | null };
      setUser(data.user ?? null);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:py-14">
      {!ready ? (
        <p className="py-16 text-center text-sm text-slate-500">加载中…</p>
      ) : (
        <PostForm defaultCity={user?.city ?? ""} />
      )}
    </main>
  );
}
