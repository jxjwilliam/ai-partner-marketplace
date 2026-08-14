"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MeDashboard from "@/components/MeDashboard";
import {
  apiFetch,
  clearClientToken,
  getClientToken,
} from "@/lib/auth/client-session";

type DashboardData = {
  profile: {
    nickname: string;
    phone: string;
    city: string;
    role: string;
    bio: string;
    skills: string[];
    yearsExperience: number | null;
  };
  posts: Array<{
    id: string;
    title: string;
    status: "active" | "hidden";
    bumpedAt: string;
  }>;
  incoming: Array<{
    id: string;
    message: string;
    createdAt: string;
    requesterName: string;
    postTitle: string;
  }>;
  outgoing: Array<{
    id: string;
    status: "pending" | "approved" | "rejected";
    createdAt: string;
    postId: string;
    postTitle: string;
    authorName: string;
    contact?: string;
  }>;
};

export default function MePage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getClientToken()) {
        router.replace("/login?next=/me");
        return;
      }
      const res = await apiFetch("/api/me/dashboard");
      if (cancelled) return;
      if (!res.ok) {
        clearClientToken();
        router.replace("/login?next=/me");
        return;
      }
      const body = (await res.json()) as { data?: DashboardData };
      setData(body.data ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <p className="text-center text-sm text-slate-500">加载中…</p>
      </main>
    );
  }

  return <MeDashboard {...data} />;
}
