import Link from "next/link";
import { Sparkles } from "lucide-react";
import { POST_TYPE_LABEL } from "@/lib/constants";
import type { PostType } from "@/lib/types";

export type RecommendedItem = {
  post: {
    id: string;
    type: PostType;
    title: string;
    city: string;
  } | null;
  score: number;
  reason: string;
};

export default function RecommendedPosts({
  items,
}: {
  items: RecommendedItem[];
}) {
  if (!items.length) return null;

  return (
    <section aria-label="AI 为你推荐" className="mb-6">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="flex items-center gap-1.5 text-base font-semibold text-[#1F3A5F]">
          <Sparkles className="h-4 w-4 text-cyan-600" aria-hidden="true" />
          AI 为你推荐
        </h2>
        <span className="text-xs text-slate-400">
          基于技能、城市与身份画像，30 分钟更新一次
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map(
          (item) =>
            item.post && (
              <Link
                className="group rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm transition hover:border-cyan-400 hover:shadow-md"
                href={`/posts/${item.post.id}`}
                key={item.post.id}
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-cyan-50 px-2 py-0.5 font-semibold text-cyan-700">
                    {POST_TYPE_LABEL[item.post.type]}
                  </span>
                  <span className="text-slate-500">{item.post.city}</span>
                </div>
                <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-[#1F3A5F] transition group-hover:text-cyan-700">
                  {item.post.title}
                </h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  💡 {item.reason}
                </p>
              </Link>
            ),
        )}
      </div>
    </section>
  );
}
