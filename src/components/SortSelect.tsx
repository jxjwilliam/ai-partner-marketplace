"use client";

export default function SortSelect({
  value,
  filters,
  page,
}: {
  value: "latest" | "hot";
  filters: Record<string, string>;
  page: number;
}) {
  function hrefFor(sort: string) {
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(filters)) {
      if (val) params.set(key, val);
    }
    if (sort !== "latest") params.set("sort", sort);
    if (page > 1) params.set("page", String(page));
    return params.toString() ? `/?${params.toString()}` : "/";
  }

  return (
    <select
      aria-label="排序方式"
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-cyan-500"
      value={value}
      onChange={(event) => window.location.assign(hrefFor(event.target.value))}
    >
      <option value="latest">最新发布</option>
      <option value="hot">热度最高</option>
    </select>
  );
}
