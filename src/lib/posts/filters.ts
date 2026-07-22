import { Prisma, PostType } from "@prisma/client";

export const POST_FILTER_TYPES = [
  "all",
  "partner",
  "talent",
  "project",
  "funding",
] as const;

const POST_TYPES = new Set<PostType>(["partner", "talent", "project", "funding"]);

export function isValidPostFilterType(
  type: string,
): type is (typeof POST_FILTER_TYPES)[number] {
  return (POST_FILTER_TYPES as readonly string[]).includes(type);
}

export function buildPostWhere(q: {
  city?: string;
  type?: string;
  tags?: string[];
}): Prisma.PostWhereInput {
  const where: Prisma.PostWhereInput = { status: "active" };
  if (q.city && q.city !== "全部") where.city = q.city;
  if (q.type && q.type !== "all" && POST_TYPES.has(q.type as PostType)) {
    where.type = q.type as PostType;
  }
  if (q.tags?.length) {
    where.AND = q.tags.map((t) => ({ tags: { has: t } }));
  }
  return where;
}
