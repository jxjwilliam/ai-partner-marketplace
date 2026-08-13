"use client";

import { useState } from "react";

type Props = {
  type: string;
  fields: Record<string, string>;
  onAdopt: (fields: Record<string, string>) => void;
};

export default function AiPolishBlock({ type, fields, onAdopt }: Props) {
  const [polished, setPolished] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function polish() {
    setLoading(true);
    setError("");
    setPolished(null);
    try {
      const response = await fetch("/api/ai/polish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, fields }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        fields?: Record<string, string>;
        error?: string;
      };
      if (!response.ok || !result.ok || !result.fields) {
        setError(result.error ?? "润色暂不可用");
        return;
      }
      setPolished(result.fields);
    } catch {
      setError("润色暂不可用");
    } finally {
      setLoading(false);
    }
  }

  function adopt() {
    if (!polished) return;
    onAdopt(polished);
    setPolished(null);
  }

  return (
    <aside className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-slate-900">AI 文案助手</h2>
          <p className="mt-1 text-sm text-slate-600">
            优化标题和正文表达，不会处理私密联系方式。
          </p>
        </div>
        <button
          className="shrink-0 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={loading}
          type="button"
          onClick={polish}
        >
          {loading ? "润色中…" : "一键润色"}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {polished && (
        <div className="mt-4 rounded-xl bg-white p-4">
          <p className="text-sm font-medium text-slate-700">润色结果</p>
          <dl className="mt-3 space-y-3">
            {Object.entries(polished).map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs text-slate-400">{key}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex gap-3">
            <button
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white"
              type="button"
              onClick={adopt}
            >
              采用
            </button>
            <button
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600"
              type="button"
              onClick={() => setPolished(null)}
            >
              放弃
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
