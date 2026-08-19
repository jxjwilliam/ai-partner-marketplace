"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Send } from "lucide-react";
import { apiFetch } from "@/lib/auth/client-session";
import { COMMUNITY_COMMENT_MAX_LEN } from "@/lib/constants";
import DeleteButton from "@/components/DeleteButton";

export type CommentListItem = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: { nickname: string | null; isVerified: boolean } | null;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}

export default function CommentList({
  comments,
  targetType,
  targetId,
  loggedIn,
  currentUserId,
}: {
  comments: CommentListItem[];
  targetType: "community" | "listing";
  targetId: string;
  loggedIn: boolean;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await apiFetch("/api/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          body: value,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !result.ok) {
        setError(result.error ?? "评论失败，请稍后重试");
        return;
      }
      setValue("");
      router.refresh();
    } catch {
      setError("网络连接失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
        评论（{comments.length}）
      </div>

      {comments.length > 0 && (
        <ul className="mt-3 space-y-3">
          {comments.map((comment) => (
            <li
              className="rounded-xl bg-slate-50 px-3 py-2.5"
              key={comment.id}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">
                  {comment.author?.nickname ?? "集市用户"}
                  {comment.author?.isVerified && (
                    <span className="ml-1 rounded bg-cyan-50 px-1 py-0.5 text-[10px] font-medium text-cyan-700">
                      ✓ 已认证
                    </span>
                  )}
                </span>
                <span>{timeAgo(comment.createdAt)}</span>
                {comment.authorId === currentUserId && (
                  <span className="ml-auto">
                    <DeleteButton
                      url={`/api/comments/${comment.id}`}
                      confirmText="删除这条评论？"
                      label="删除"
                    />
                  </span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {comment.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {loggedIn ? (
        <form className="mt-3 flex items-start gap-2" onSubmit={submit}>
          <textarea
            className="min-h-12 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm leading-5 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={COMMUNITY_COMMENT_MAX_LEN}
            placeholder="写下你的看法…（联系方式会自动隐藏）"
          />
          <button
            className="flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy || !value.trim()}
            type="submit"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            {busy ? "发送中…" : "评论"}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-slate-400">
          <Link className="text-cyan-600 hover:underline" href="/login">
            登录
          </Link>
          {" 后参与评论"}
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
