"use client";

import Link from "next/link";
import { useState } from "react";
import {
  FileText,
  Inbox,
  Send,
  UserRound,
} from "lucide-react";
import { apiFetch } from "@/lib/auth/client-session";

type PostItem = {
  id: string;
  title: string;
  status: "active" | "hidden";
  bumpedAt: string;
};

type IncomingItem = {
  id: string;
  message: string;
  createdAt: string;
  requesterName: string;
  postTitle: string;
};

type OutgoingItem = {
  id: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  postId: string;
  postTitle: string;
  authorName: string;
  contact?: string;
};

const STATUS_LABEL = {
  pending: "待处理",
  approved: "已通过",
  rejected: "未通过",
} as const;

export default function MeDashboard({
  profile,
  posts,
  incoming,
  outgoing,
}: {
  profile: {
    nickname: string | null;
    phone: string;
    email: string | null;
    city: string | null;
    role: string;
    bio: string | null;
    skills: string[];
    yearsExperience: number | null;
  };
  posts: PostItem[];
  incoming: IncomingItem[];
  outgoing: OutgoingItem[];
}) {
  const [tab, setTab] = useState<"posts" | "requests">("posts");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function mutate(url: string, body: unknown, key: string) {
    setBusy(key);
    setError("");
    try {
      const response = await apiFetch(url, {
        method: url.startsWith("/api/unlock/") ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setError(result.error ?? "操作失败，请稍后重试");
        return;
      }
      window.location.reload();
    } catch {
      setError("网络连接失败，请稍后重试");
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <section className="border border-slate-200 bg-white p-5 sm:p-7">
        <p className="text-sm font-medium text-cyan-600">个人中心</p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-[#1F3A5F]">
          <UserRound className="h-6 w-6 text-cyan-600" aria-hidden="true" />
          {profile.nickname ?? "集市用户"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {[
            profile.role,
            profile.city,
            profile.phone,
            profile.email,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {profile.yearsExperience != null && (
          <p className="mt-1 text-sm text-slate-500">
            {profile.yearsExperience} 年以上经验
          </p>
        )}
        {profile.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profile.skills.map((skill) => (
              <span
                className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                key={skill}
              >
                {skill}
              </span>
            ))}
          </div>
        )}
        {profile.bio && (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
            {profile.bio}
          </p>
        )}
      </section>

      <div className="mt-6 flex border-b border-slate-200">
        {[
          ["posts", "我的帖子"],
          ["requests", "联系方式申请"],
        ].map(([value, label]) => (
          <button
            className={`flex items-center gap-1.5 border-b-2 px-5 py-3 text-sm font-semibold ${
              tab === value
                ? "border-cyan-600 text-cyan-700"
                : "border-transparent text-slate-500"
            }`}
            key={value}
            onClick={() => setTab(value as typeof tab)}
            type="button"
          >
            {value === "posts" ? (
              <FileText className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Inbox className="h-4 w-4" aria-hidden="true" />
            )}
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {tab === "posts" ? (
        <section className="mt-5 space-y-3">
          {posts.length === 0 && (
            <p className="border border-slate-200 bg-white p-6 text-sm text-slate-500">
              还没有发布帖子。
            </p>
          )}
          {posts.map((post) => (
            <article
              className="flex flex-wrap items-center gap-3 border border-slate-200 bg-white p-4"
              key={post.id}
            >
              <div className="min-w-0 flex-1">
                <Link
                  className="font-semibold text-slate-900 hover:text-cyan-600"
                  href={`/posts/${post.id}`}
                >
                  {post.title}
                </Link>
                <p className="mt-1 text-xs text-slate-400">
                  {post.status === "active" ? "展示中" : "已隐藏"} · 最近顶帖{" "}
                  {new Date(post.bumpedAt).toLocaleDateString("zh-CN")}
                </p>
              </div>
              {post.status === "active" && (
                <button
                  className="border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    mutate(
                      `/api/posts/${post.id}`,
                      { status: "hidden" },
                      `hide-${post.id}`,
                    )
                  }
                  type="button"
                >
                  {busy === `hide-${post.id}` ? "处理中…" : "隐藏"}
                </button>
              )}
              <button
                className="bg-slate-900 px-3 py-2 text-xs font-medium text-white"
                disabled={Boolean(busy) || post.status === "hidden"}
                onClick={() =>
                  mutate(`/api/posts/${post.id}`, { bump: true }, `bump-${post.id}`)
                }
                type="button"
              >
                {busy === `bump-${post.id}` ? "处理中…" : "顶帖"}
              </button>
            </article>
          ))}
        </section>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 flex items-center gap-1.5 font-semibold text-slate-950">
              <Inbox className="h-4 w-4 text-cyan-600" aria-hidden="true" />
              收到的申请
            </h2>
            <div className="space-y-3">
              {incoming.length === 0 && (
                <p className="border border-slate-200 bg-white p-5 text-sm text-slate-500">
                  暂无待处理申请。
                </p>
              )}
              {incoming.map((item) => (
                <article className="border border-slate-200 bg-white p-4" key={item.id}>
                  <p className="text-sm font-semibold text-slate-900">
                    {item.requesterName} · {item.postTitle}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {item.message}
                  </p>
                  <div className="mt-4 flex gap-2">
                    {(["approve", "reject"] as const).map((action) => (
                      <button
                        className={
                          action === "approve"
                            ? "bg-cyan-600 px-3 py-2 text-xs font-semibold text-white"
                            : "border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                        }
                        disabled={Boolean(busy)}
                        key={action}
                        onClick={() =>
                          mutate(
                            `/api/unlock/${item.id}`,
                            { action },
                            `${action}-${item.id}`,
                          )
                        }
                        type="button"
                      >
                        {action === "approve" ? "通过" : "拒绝"}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-1.5 font-semibold text-slate-950">
              <Send className="h-4 w-4 text-cyan-600" aria-hidden="true" />
              发出的申请
            </h2>
            <div className="space-y-3">
              {outgoing.length === 0 && (
                <p className="border border-slate-200 bg-white p-5 text-sm text-slate-500">
                  还没有发出申请。
                </p>
              )}
              {outgoing.map((item) => (
                <article className="border border-slate-200 bg-white p-4" key={item.id}>
                  <Link
                    className="text-sm font-semibold text-slate-900 hover:text-cyan-600"
                    href={`/posts/${item.postId}`}
                  >
                    {item.postTitle}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.authorName} · {STATUS_LABEL[item.status]}
                  </p>
                  {item.contact && (
                    <p className="mt-3 whitespace-pre-wrap bg-emerald-50 p-3 text-sm text-emerald-800">
                      联系方式：{item.contact}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
