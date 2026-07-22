import { Prisma, PostType } from "@prisma/client";

export function buildPostWhere(q: {
  city?: string;
  type?: string;
  tags?: string[];
}): Prisma.PostWhereInput {
  const where: Prisma.PostWhereInput = { status: "active" };
  if (q.city && q.city !== "全部") where.city = q.city;
  if (q.type && q.type !== "all") where.type = q.type as PostType;
  if (q.tags?.length) {
    where.AND = q.tags.map((t) => ({ tags: { has: t } }));
  }
  return where;
}
