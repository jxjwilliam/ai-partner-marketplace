import { UserRound } from "lucide-react";
import type { CommunityPost } from "@/lib/data";
import CommentList, { type CommentListItem } from "@/components/CommentList";
import DeleteButton from "@/components/DeleteButton";

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

export default function CommunityPostCard({
  post,
  loggedIn,
  currentUserId,
}: {
  post: CommunityPost;
  loggedIn: boolean;
  currentUserId: string | null;
}) {
  const comments: CommentListItem[] = post.comments.map((comment) => ({
    id: comment.id,
    authorId: comment.authorId,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    author: comment.author
      ? {
          nickname: comment.author.nickname,
          isVerified: comment.author.isVerified,
        }
      : null,
  }));

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1F3A5F]/10 text-[#1F3A5F]">
          <UserRound className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-semibold text-slate-900">
              {post.author?.nickname ?? "集市用户"}
              {post.author?.isVerified && (
                <span className="ml-1.5 rounded bg-cyan-50 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700">
                  ✓ 已认证
                </span>
              )}
            </span>
            <span className="text-xs text-slate-400">{timeAgo(post.createdAt)}</span>
            {post.authorId === currentUserId && (
              <span className="ml-auto">
                <DeleteButton
                  url={`/api/community/${post.id}`}
                  confirmText="删除这条动态及其评论？"
                  label="删除动态"
                />
              </span>
            )}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-800">
            {post.body}
          </p>
          <CommentList
            comments={comments}
            targetType="community"
            targetId={post.id}
            loggedIn={loggedIn}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </article>
  );
}
