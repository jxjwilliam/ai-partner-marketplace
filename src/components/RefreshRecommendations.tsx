"use client";

export default function RefreshRecommendations() {
  return (
    <button
      className="shrink-0 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#1F3A5F] transition hover:border-cyan-400 hover:text-cyan-700"
      onClick={() => window.location.assign("/recommendations?refresh=1")}
      type="button"
    >
      刷新推荐
    </button>
  );
}
