import type { PostType } from "@/lib/types";

export const POST_FILTER_TYPES = [
  "all",
  "partner",
  "talent",
  "project",
  "funding",
] as const;

const POST_TYPES = new Set<PostType>(["partner", "talent", "project", "funding"]);
const SEARCH_KEYS = ["intro", "background", "techNeeds", "projectStage"] as const;

export function isValidPostFilterType(
  type: string,
): type is (typeof POST_FILTER_TYPES)[number] {
  return (POST_FILTER_TYPES as readonly string[]).includes(type);
}

export type PostSort = "latest" | "hot";

export function isPostSort(value: string): value is PostSort {
  return value === "latest" || value === "hot";
}

export type PostFilterInput = {
  city?: string;
  type?: PostType;
  tags?: string[];
  search?: string;
};

/**
 * 把 URL 参数归一化为可用的筛选条件（纯逻辑，便于单测）。
 */
export function buildPostWhere(q: {
  city?: string;
  type?: string;
  tags?: string[];
  search?: string;
}): PostFilterInput {
  const where: PostFilterInput = {};
  if (q.city && q.city !== "全部") where.city = q.city;
  if (q.type && q.type !== "all" && POST_TYPES.has(q.type as PostType)) {
    where.type = q.type as PostType;
  }
  if (q.tags?.length) where.tags = q.tags;
  const search = q.search?.trim();
  if (search) where.search = search;
  return where;
}

/**
 * 生成 PostgREST `or(...)` 子句：标题 + JSON 正文关键字段的模糊匹配。
 * 对通配符/引号做净化，避免注入 OR 过滤器。
 */
export function buildSearchClause(search: string): string | null {
  const value = search
    .trim()
    .replace(/[*,%()'"\\]/g, "")
    .trim();
  if (!value) return null;
  const parts = [
    `title.ilike.*${value}*`,
    ...SEARCH_KEYS.map((key) => `body_json->>${key}.ilike.*${value}*`),
  ];
  return parts.join(",");
}
