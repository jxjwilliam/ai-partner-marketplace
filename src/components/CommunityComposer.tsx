"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { apiFetch } from "@/lib/auth/client-session";
import { COMMUNITY_POST_MAX_LEN } from "@/lib/constants";

export default function CommunityComposer() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await apiFetch("/api/community", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: value }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !result.ok) {
        setError(result.error ?? "发布失败，请稍后重试");
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
    <form
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      onSubmit={submit}
    >
      <label
        className="flex items-center gap-1.5 text-sm font-semibold text-[#1F3A5F]"
        htmlFor="community-body"
      >
        <MessageSquarePlus className="h-4 w-4 text-cyan-600" aria-hidden="true" />
        发布一条动态
      </label>
      <textarea
        className="mt-3 min-h-24 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
        id="community-body"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={COMMUNITY_POST_MAX_LEN}
        placeholder="分享踩坑经验、找队友、晒作品，或抛出一个想聊的问题…"
      />
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400">
          {value.length}/{COMMUNITY_POST_MAX_LEN} · 联系方式会被自动隐藏
        </span>
        <button
          className="rounded-lg bg-[#1F3A5F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy || !value.trim()}
          type="submit"
        >
          {busy ? "发布中…" : "发布动态"}
        </button>
      </div>
    </form>
  );
}
