import Link from "next/link";
import { LayoutGrid, MapPin, Tag } from "lucide-react";
import { CITIES, POST_TYPE_LABEL, TAGS } from "@/lib/constants";
import { POST_FILTER_TYPES } from "@/lib/posts/filters";

type FilterBarProps = {
  city?: string;
  type?: string;
  tags: string[];
  search?: string;
  sort?: string;
  page?: number;
};

export default function FilterBar({
  city,
  type = "all",
  tags,
  search,
  sort,
  page,
}: FilterBarProps) {
  function hrefFor(changes: {
    city?: string;
    type?: string;
    tags?: string[];
  }) {
    const params = new URLSearchParams();
    const nextCity = changes.city ?? city;
    const nextType = changes.type ?? type;
    const nextTags = changes.tags ?? tags;

    if (nextCity && nextCity !== "全部") params.set("city", nextCity);
    if (nextType && nextType !== "all") params.set("type", nextType);
    if (nextTags.length) params.set("tags", nextTags.join(","));
    if (search?.trim()) params.set("q", search.trim());
    if (sort && sort !== "latest") params.set("sort", sort);
    if (page && page > 1) params.set("page", String(page));

    const query = params.toString();
    return query ? `/?${query}` : "/";
  }

  return (
    <section
      aria-label="筛选帖子"
      className="rounded-2xl border border-slate-200 bg-white text-sm shadow-sm"
    >
      <div className="flex overflow-hidden rounded-t-2xl border-b border-slate-100">
        <span className="flex w-20 shrink-0 items-center gap-1.5 bg-slate-50 px-3 py-3 font-medium text-slate-500">
          <MapPin className="h-4 w-4" aria-hidden="true" />
          城市
        </span>
        <div className="flex flex-wrap gap-x-1 gap-y-2 px-3 py-2">
          {CITIES.map((item) => {
            const selected = item === "全部" ? !city : city === item;
            return (
              <Link
                aria-current={selected ? "page" : undefined}
                className={`rounded px-2 py-1 ${
                  selected
                    ? "bg-[#1F3A5F] font-medium text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                href={hrefFor({ city: item })}
                key={item}
              >
                {item}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex border-b border-slate-100">
        <span className="flex w-20 shrink-0 items-center gap-1.5 bg-slate-50 px-3 py-3 font-medium text-slate-500">
          <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          类型
        </span>
        <div className="flex flex-wrap gap-x-1 gap-y-2 px-3 py-2">
          {POST_FILTER_TYPES.map((item) => {
            const selected = type === item;
            return (
              <Link
                aria-current={selected ? "page" : undefined}
                className={`rounded px-2 py-1 ${
                  selected
                    ? "bg-cyan-600 font-medium text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                href={hrefFor({ type: item })}
                key={item}
              >
                {item === "all" ? "全部" : POST_TYPE_LABEL[item]}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex">
        <span className="flex w-20 shrink-0 items-center gap-1.5 bg-slate-50 px-3 py-3 font-medium text-slate-500">
          <Tag className="h-4 w-4" aria-hidden="true" />
          标签
        </span>
        <div className="flex flex-wrap gap-x-1 gap-y-2 px-3 py-2">
          {TAGS.map((tag) => {
            const selected = tags.includes(tag);
            const nextTags = selected
              ? tags.filter((item) => item !== tag)
              : [...tags, tag];
            return (
              <Link
                aria-pressed={selected}
                className={`rounded px-2 py-1 ${
                  selected
                    ? "bg-cyan-50 font-medium text-cyan-800"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                href={hrefFor({ tags: nextTags })}
                key={tag}
              >
                {tag}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
