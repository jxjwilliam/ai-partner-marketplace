"use client";

import { FormEvent, useState } from "react";
import { Search } from "lucide-react";

export default function SearchBox({
  defaultValue = "",
  filters,
}: {
  defaultValue?: string;
  filters: Record<string, string>;
}) {
  const [value, setValue] = useState(defaultValue);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    const query = value.trim();
    if (query) params.set("q", query);
    for (const [key, val] of Object.entries(filters)) {
      if (val) params.set(key, val);
    }
    window.location.assign(params.toString() ? `/?${params.toString()}` : "/");
  }

  return (
    <form
      className="relative max-w-2xl"
      onSubmit={submit}
      role="search"
      aria-label="搜索合作信息"
    >
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
      />
      <input
        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-28 text-sm text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="搜索机会、人才或项目…"
        maxLength={60}
      />
      <button
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-[#1F3A5F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2a4d7a]"
        type="submit"
      >
        搜索
      </button>
    </form>
  );
}
