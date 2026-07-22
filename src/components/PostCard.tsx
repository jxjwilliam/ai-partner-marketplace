import Link from "next/link";
import type { PostType } from "@prisma/client";
import { POST_TYPE_LABEL } from "@/lib/constants";

const TYPE_STYLES: Record<PostType, string> = {
  partner: "bg-indigo-50 text-indigo-700",
  talent: "bg-emerald-50 text-emerald-700",
  project: "bg-amber-50 text-amber-700",
  funding: "bg-rose-50 text-rose-700",
};

export type PostCardPost = {
  id: string;
  type: PostType;
  title: string;
  city: string;
  tags: string[];
  bodyJson: unknown;
  viewCount: number;
  bumpedAt: Date;
};

function snippetFrom(bodyJson: unknown) {
  if (!bodyJson || typeof bodyJson !== "object" || Array.isArray(bodyJson)) {
    return "";
  }
  const body = bodyJson as Record<string, unknown>;
  const value = body.intro ?? body.background ?? body.techNeeds;
  if (typeof value !== "string") return "";
  return value.length > 110 ? `${value.slice(0, 110)}…` : value;
}

export default function PostCard({ post }: { post: PostCardPost }) {
  const snippet = snippetFrom(post.bodyJson);

  return (
    <Link
      className="block border-b border-slate-200 px-4 py-4 transition hover:bg-slate-50 sm:px-5"
      href={`/posts/${post.id}`}
    >
      <article>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded px-2 py-1 font-semibold ${TYPE_STYLES[post.type]}`}
          >
            {POST_TYPE_LABEL[post.type]}
          </span>
          <span className="text-slate-500">{post.city}</span>
          <span className="ml-auto text-slate-400">
            {post.bumpedAt.toLocaleDateString("zh-CN")} · {post.viewCount} 次浏览
          </span>
        </div>
        <h2 className="mt-2 text-base font-semibold text-slate-950 sm:text-lg">
          {post.title}
        </h2>
        {snippet && (
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
            {snippet}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <span
              className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
      </article>
    </Link>
  );
}
