import { redirect } from "next/navigation";
import MeDashboard from "@/components/MeDashboard";
import { getSessionUser } from "@/lib/auth/session";
import {
  listIncomingUnlocks,
  listMyPosts,
  listOutgoingUnlocks,
} from "@/lib/data";
import { shouldRevealContact } from "@/lib/posts/visibility";

const ROLE_LABELS: Record<string, string> = {
  talent: "技术人才",
  founder: "项目方",
  investor: "投资人",
  other: "其他",
};

export default async function MePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/me");

  const [posts, incoming, outgoing] = await Promise.all([
    listMyPosts(user.id),
    listIncomingUnlocks(user.id),
    listOutgoingUnlocks(user.id),
  ]);

  return (
    <MeDashboard
      profile={{
        nickname: user.nickname,
        phone: user.phone,
        city: user.city,
        role: user.roleTag ? ROLE_LABELS[user.roleTag] : "身份待完善",
        bio: user.bio,
        skills: user.skills,
        yearsExperience: user.yearsExperience,
      }}
      posts={posts.map((post) => ({
        ...post,
        bumpedAt: post.bumpedAt.toISOString(),
      }))}
      incoming={incoming.map((item) => ({
        id: item.id,
        message: item.message,
        createdAt: item.createdAt.toISOString(),
        requesterName: item.requesterName ?? "集市用户",
        postTitle: item.postTitle,
      }))}
      outgoing={outgoing.map((item) => {
        const reveal =
          item.post &&
          shouldRevealContact({
            viewerId: user.id,
            authorId: item.post.authorId,
            unlockStatus: item.status,
          });
        return {
          id: item.id,
          status: item.status,
          createdAt: item.createdAt.toISOString(),
          postId: item.post?.id ?? "",
          postTitle: item.post?.title ?? "",
          authorName: item.post?.authorName ?? "集市用户",
          contact: reveal ? item.post!.contactPrivate : undefined,
        };
      })}
    />
  );
}
