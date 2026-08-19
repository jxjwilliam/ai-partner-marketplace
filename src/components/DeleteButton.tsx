"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/auth/client-session";

export default function DeleteButton({
  url,
  confirmText = "确定删除吗？",
  label = "删除",
}: {
  url: string;
  confirmText?: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (typeof window !== "undefined" && !window.confirm(confirmText)) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(url, { method: "DELETE" });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !result.ok) {
        setError(result.error ?? "删除失败，请稍后重试");
        return;
      }
      router.refresh();
    } catch {
      setError("网络连接失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        className="flex items-center gap-1 text-xs text-slate-400 transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy}
        onClick={() => void remove()}
        type="button"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        {busy ? "删除中…" : label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
