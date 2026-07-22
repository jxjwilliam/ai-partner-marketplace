"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { UNLOCK_MIN_MESSAGE_LEN } from "@/lib/constants";

type UnlockStatus = "pending" | "approved" | "rejected" | null;

export default function ContactUnlockPanel({
  postId,
  loggedIn,
  isAuthor,
  initialStatus,
  contact,
}: {
  postId: string;
  loggedIn: boolean;
  isAuthor: boolean;
  initialStatus: UnlockStatus;
  contact?: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(`/api/posts/${postId}/unlock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        request?: { status: UnlockStatus };
      };
      if (!response.ok || !result.ok) {
        setError(result.error ?? "提交失败，请稍后重试");
        return;
      }
      setStatus(result.request?.status ?? "pending");
      setMessage("");
    } catch {
      setError("网络连接失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="border border-indigo-200 bg-indigo-50 p-5">
      <h2 className="font-semibold text-indigo-950">联系发布者</h2>

      {contact ? (
        <>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-indigo-500">
            联系方式
          </p>
          <p className="mt-1 whitespace-pre-wrap wrap-break-word text-sm font-medium text-indigo-950">
            {contact}
          </p>
        </>
      ) : isAuthor ? (
        <p className="mt-2 text-sm leading-6 text-indigo-700">
          这是你的帖子，联系方式仅对你和获批申请人可见。
        </p>
      ) : !loggedIn ? (
        <Link
          className="mt-4 block bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-indigo-700"
          href={`/login?next=/posts/${postId}`}
        >
          请先登录后申请
        </Link>
      ) : status === "pending" ? (
        <p className="mt-2 text-sm leading-6 text-indigo-700">
          申请已提交，等待发布者处理。
        </p>
      ) : (
        <>
          {status === "rejected" && (
            <p className="mt-2 text-sm leading-6 text-amber-700">
              申请未通过。你可以补充介绍后再次申请。
            </p>
          )}
          <form className="mt-4 space-y-3" onSubmit={submit}>
            <label className="block text-sm font-medium text-indigo-950">
              简单介绍你的背景和合作意向
              <textarea
                className="mt-2 min-h-24 w-full resize-y border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                minLength={UNLOCK_MIN_MESSAGE_LEN}
                maxLength={500}
                required
              />
            </label>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button
              className="w-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "正在提交…" : "申请查看联系方式"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
