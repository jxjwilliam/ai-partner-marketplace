"use client";

import { RefreshCw } from "lucide-react";

export default function RefreshRecommendations({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <button
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#1F3A5F] transition hover:border-cyan-400 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={refreshing}
      onClick={onRefresh}
      type="button"
    >
      <RefreshCw
        aria-hidden="true"
        className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
      />
      {refreshing ? "刷新中…" : "刷新推荐"}
    </button>
  );
}
