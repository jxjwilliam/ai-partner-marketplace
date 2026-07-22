import { redirect } from "next/navigation";
import MeDashboard from "@/components/MeDashboard";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
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

  const [posts, incoming, outgoingRaw] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: user.id },
      orderBy: { bumpedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        bumpedAt: true,
      },
    }),
    prisma.contactRequest.findMany({
      where: {
        status: "pending",
        post: { authorId: user.id },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        message: true,
        createdAt: true,
        requester: { select: { nickname: true } },
        post: { select: { title: true } },
      },
    }),
    prisma.contactRequest.findMany({
      where: { requesterId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        post: {
          select: {
            id: true,
            title: true,
            authorId: true,
            contactPrivate: true,
            author: { select: { nickname: true } },
          },
        },
      },
    }),
  ]);

  const outgoing = outgoingRaw.map((item) => {
    const reveal = shouldRevealContact({
      viewerId: user.id,
      authorId: item.post.authorId,
      unlockStatus: item.status,
    });
    return {
      id: item.id,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      postId: item.post.id,
      postTitle: item.post.title,
      authorName: item.post.author.nickname ?? "集市用户",
      contact: reveal ? item.post.contactPrivate : undefined,
    };
  });

  return (
    <MeDashboard
      profile={{
        nickname: user.nickname,
        phone: user.phone,
        city: user.city,
        role: user.roleTag ? ROLE_LABELS[user.roleTag] : "身份待完善",
        bio: user.bio,
      }}
      posts={posts.map((post) => ({
        ...post,
        bumpedAt: post.bumpedAt.toISOString(),
      }))}
      incoming={incoming.map((item) => ({
        id: item.id,
        message: item.message,
        createdAt: item.createdAt.toISOString(),
        requesterName: item.requester.nickname ?? "集市用户",
        postTitle: item.post.title,
      }))}
      outgoing={outgoing}
    />
  );
}
