import Link from "next/link";
import type { PostType } from "@/lib/types";
import { POST_TYPE_LABEL } from "@/lib/constants";

const TYPE_STYLES: Record<PostType, string> = {
  partner: "bg-[#1F3A5F]/10 text-[#1F3A5F]",
  talent: "bg-emerald-50 text-emerald-700",
  project: "bg-cyan-50 text-cyan-700",
  funding: "bg-amber-50 text-amber-700",
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
  author?: {
    id?: string;
    nickname: string | null;
    city?: string | null;
    roleTag?: string | null;
    isVerified?: boolean;
  } | null;
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

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return date.toLocaleDateString("zh-CN");
}

export default function PostCard({ post }: { post: PostCardPost }) {
  const snippet = snippetFrom(post.bodyJson);
  const verified = post.author?.isVerified;

  return (
    <Link
      className="group block px-4 py-4 transition hover:bg-slate-50/80 sm:px-5"
      href={`/posts/${post.id}`}
    >
      <article className="rounded-xl border border-transparent px-3 py-2 transition group-hover:border-cyan-100 group-hover:shadow-sm sm:px-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2.5 py-1 font-semibold ${TYPE_STYLES[post.type]}`}
          >
            {POST_TYPE_LABEL[post.type]}
          </span>
          <span className="text-slate-500">{post.city}</span>
          <span className="ml-auto text-slate-400">
            {timeAgo(post.bumpedAt)} · {post.viewCount} 次浏览
          </span>
        </div>
        <h2 className="mt-2 text-base font-semibold text-[#1F3A5F] transition group-hover:text-cyan-700 sm:text-lg">
          {post.title}
          {verified && (
            <span className="ml-2 align-middle rounded bg-cyan-50 px-1.5 py-0.5 text-xs font-medium text-cyan-700">
              ✓ 已认证
            </span>
          )}
        </h2>
        {snippet && (
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
            {snippet}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {post.author?.nickname && (
            <span className="text-xs text-slate-500">
              {post.author.nickname}
            </span>
          )}
          {post.tags.map((tag) => (
            <span
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
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
