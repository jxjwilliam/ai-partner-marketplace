import type { PostType, User } from "@/lib/types";
import {
  getCachedRecommendations,
  getPostsByIds,
  listPostsForMatching,
  upsertRecommendations,
} from "@/lib/data";
import { scrubContactText } from "@/lib/ai/polish";
import { AI_REQUEST_TIMEOUT_MS } from "@/lib/constants";

const CACHE_TTL_MS = 30 * 60 * 1000;
export const RECOMMENDATIONS_PAGE_SIZE = 5;
export const RECOMMENDATIONS_CACHE_SIZE = 20;

const ROLE_LABEL: Record<string, string> = {
  talent: "技术人才",
  founder: "项目方",
  investor: "投资人",
  other: "其他",
};

const POST_TYPE_LABEL: Record<string, string> = {
  partner: "找合伙人",
  talent: "我是人才",
  project: "接项目",
  funding: "找资金",
};

const ROLE_AFFINITY: Record<string, Partial<Record<PostType, number>>> = {
  talent: { partner: 3, project: 2 },
  founder: { talent: 3, partner: 1, project: 1 },
  investor: { funding: 3 },
  other: { partner: 1, talent: 1, project: 1 },
};

export type MatchCandidate = {
  id: string;
  authorId: string;
  type: PostType;
  title: string;
  city: string;
  tags: string[];
  bodyJson: Record<string, unknown>;
};

export type MatchScoreDetail = {
  score: number;
  reasons: string[];
};

/**
 * 规则评分：技能命中（+4/个）、同城（+3）/远程（+2）、身份契合（+1~3）、
 * 资深年限加成（+1）。返回分数与可读理由（供 LLM 不可用时的兜底文案）。
 */
export function scorePostForUser(
  user: User,
  post: MatchCandidate,
): MatchScoreDetail {
  let score = 0;
  const reasons: string[] = [];
  const skills = (user.skills ?? [])
    .map((skill) => skill.trim().toLowerCase())
    .filter(Boolean);
  const tags = new Set((post.tags ?? []).map((tag) => tag.toLowerCase()));
  const bodyText = JSON.stringify(post.bodyJson ?? {}).toLowerCase();

  let skillHits = 0;
  for (const skill of skills) {
    if (tags.has(skill) || bodyText.includes(skill)) skillHits += 1;
  }
  if (skillHits > 0) {
    score += skillHits * 4;
    reasons.push(`技能匹配「${(user.skills ?? []).slice(0, 2).join("、")}」`);
  }

  if (post.city && post.city === user.city) {
    score += 3;
    reasons.push(`同城（${post.city}）`);
  } else if (post.city === "远程") {
    score += 2;
    reasons.push("支持远程");
  }

  const affinity = ROLE_AFFINITY[user.roleTag ?? "other"]?.[post.type] ?? 0;
  if (affinity > 0) {
    score += affinity;
    reasons.push(
      `${ROLE_LABEL[user.roleTag ?? "other"]}契合「${POST_TYPE_LABEL[post.type]}」`,
    );
  }

  if (
    (user.yearsExperience ?? 0) >= 8 &&
    (post.type === "partner" || post.type === "talent")
  ) {
    score += 1;
  }

  return { score, reasons };
}

export function fallbackReason(detail: MatchScoreDetail): string {
  return detail.reasons.slice(0, 2).join("；") || "画像匹配度高";
}

function extractIntro(bodyJson: Record<string, unknown>): string {
  const value = bodyJson.intro ?? bodyJson.background ?? bodyJson.techNeeds;
  return typeof value === "string" ? value : "";
}

/**
 * 用 LLM 为候选帖子生成一句中文推荐理由。
 * 入参先脱敏（去手机号/邮箱/微信），失败时返回空对象由调用方兜底。
 */
export async function generateMatchReasons(
  user: User,
  candidates: MatchCandidate[],
  timeoutMs: number = AI_REQUEST_TIMEOUT_MS,
): Promise<Record<string, string>> {
  const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY;
  const baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL;
  if (!apiKey || !baseUrl || candidates.length === 0) return {};

  const safeUser = {
    skills: user.skills ?? [],
    yearsExperience: user.yearsExperience ?? null,
    city: user.city ?? null,
    roleTag: user.roleTag ?? null,
    bio: scrubContactText(user.bio ?? ""),
  };
  const safePosts = candidates.map((post) => ({
    post_id: post.id,
    title: scrubContactText(post.title),
    city: post.city,
    tags: post.tags ?? [],
    intro: scrubContactText(extractIntro(post.bodyJson)).slice(0, 120),
  }));

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_COMPATIBLE_MODEL || "qwen-plus",
      messages: [
        {
          role: "system",
          content:
            "你是「AI合伙人集市」的匹配助手。根据用户画像与候选帖子，为每条候选写一句中文推荐理由（不超过 40 字），聚焦技能、城市、身份契合度。只返回 JSON 数组，元素为 {\"post_id\":\"...\",\"reason\":\"...\"}，post_id 必须来自候选列表。不要虚构帖子，不要包含联系方式。",
        },
        {
          role: "user",
          content: JSON.stringify({ user: safeUser, posts: safePosts }),
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) return {};
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  const parsed: unknown = JSON.parse(
    text.replace(/^```json\s*|\s*```$/gi, "").trim(),
  );
  if (!Array.isArray(parsed)) return {};

  const validIds = new Set(candidates.map((post) => post.id));
  const reasons: Record<string, string> = {};
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const { post_id, reason } = item as { post_id?: unknown; reason?: unknown };
    if (
      typeof post_id === "string" &&
      validIds.has(post_id) &&
      typeof reason === "string"
    ) {
      reasons[post_id] = scrubContactText(reason.trim()).slice(0, 60);
    }
  }
  return reasons;
}

export type RecommendationItem = {
  postId: string;
  score: number;
  reason: string;
};

/**
 * 为用户生成推荐：先读缓存（30 分钟 TTL），未命中则评分 → LLM 理由 → 入库。
 */
export async function recommendForUser(
  user: User,
  limit: number,
  options?: { llmTimeoutMs?: number; skipLlm?: boolean },
): Promise<RecommendationItem[]> {
  const since = new Date(Date.now() - CACHE_TTL_MS);
  const cached = await getCachedRecommendations(user.id, since);
  if (cached.length >= limit) return cached.slice(0, limit);

  const candidates = (await listPostsForMatching(user.id)).filter(
    (post) => post.authorId !== user.id,
  );
  const scored = candidates
    .map((post) => ({ post, detail: scorePostForUser(user, post) }))
    .sort((a, b) => b.detail.score - a.detail.score)
    .slice(0, 6);

  if (scored.length === 0) return [];

  if (options?.skipLlm) {
    // 首页等 SSR 路径：只出规则结果，不等待 LLM、不写缓存。
    // 缓存里有 LLM 理由时直接命中（上面的 cache 分支），否则先用规则文案
    // 即时渲染；LLM 理由由 /recommendations 生成并写入 30 分钟缓存。
    return scored
      .map((item) => ({
        postId: item.post.id,
        score: item.detail.score,
        reason: fallbackReason(item.detail),
      }))
      .slice(0, limit);
  }

  const llmReasons = await generateMatchReasons(
    user,
    scored.map((item) => item.post),
    options?.llmTimeoutMs ?? AI_REQUEST_TIMEOUT_MS,
  ).catch((): Record<string, string> => ({}));

  const rows = scored.map((item) => ({
    postId: item.post.id,
    score: item.detail.score,
    reason: llmReasons[item.post.id] || fallbackReason(item.detail),
  }));
  await upsertRecommendations(user.id, rows);
  return rows.slice(0, limit);
}

export type LightRecommendedPost = {
  id: string;
  type: PostType;
  title: string;
  city: string;
};

export type HomeRecommendation = {
  post: LightRecommendedPost | null;
  score: number;
  reason: string;
};

/**
 * 首页专用推荐：缓存读取与候选拉取并行，省掉一次串行 DB 往返。
 * 缓存未命中时直接用规则评分结果渲染（不调 LLM、不写缓存），
 * 命中时再按 ID 取帖子详情。
 */
export async function recommendForHome(
  user: User,
  limit = 3,
): Promise<HomeRecommendation[]> {
  const since = new Date(Date.now() - CACHE_TTL_MS);
  const [cached, candidates] = await Promise.all([
    getCachedRecommendations(user.id, since),
    listPostsForMatching(user.id),
  ]);

  if (cached.length >= limit) {
    const rows = cached.slice(0, limit);
    const posts = await getPostsByIds(rows.map((item) => item.postId));
    const byId = new Map(posts.map((post) => [post.id, post]));
    return rows.map((item) => {
      const post = byId.get(item.postId);
      return {
        post: post
          ? {
              id: post.id,
              type: post.type,
              title: post.title,
              city: post.city,
            }
          : null,
        score: item.score,
        reason: item.reason,
      };
    });
  }

  const scored = candidates
    .filter((post) => post.authorId !== user.id)
    .map((post) => ({ post, detail: scorePostForUser(user, post) }))
    .sort((a, b) => b.detail.score - a.detail.score)
    .slice(0, limit);

  return scored.map((item) => ({
    post: {
      id: item.post.id,
      type: item.post.type,
      title: item.post.title,
      city: item.post.city,
    },
    score: item.detail.score,
    reason: fallbackReason(item.detail),
  }));
}

export type RecommendationPageItem = {
  post: LightRecommendedPost | null;
  score: number;
  reason: string;
};

/**
 * 推荐页快速路径（SSR/API 共用）：只读缓存或规则评分，绝不等待 LLM。
 * - 缓存命中：按页返回（llm=true 表示已有 AI 理由）。
 * - 缓存未命中：立即算规则结果并写入缓存（llm=false），
 *   由前端在后台触发一次 LLM 刷新，避免首屏等待。
 */
export async function listRecommendationItems(
  user: User,
  page = 1,
): Promise<{
  items: RecommendationPageItem[];
  hasMore: boolean;
  llmReady: boolean;
}> {
  const since = new Date(Date.now() - CACHE_TTL_MS);
  const cached = await getCachedRecommendations(
    user.id,
    since,
    RECOMMENDATIONS_CACHE_SIZE,
  );

  if (cached.length > 0) {
    const pageRows = cached.slice(
      (page - 1) * RECOMMENDATIONS_PAGE_SIZE,
      page * RECOMMENDATIONS_PAGE_SIZE,
    );
    const posts = await getPostsByIds(pageRows.map((item) => item.postId));
    const byId = new Map(posts.map((post) => [post.id, post]));
    return {
      items: pageRows.map((item) => {
        const post = byId.get(item.postId);
        return {
          post: post
            ? {
                id: post.id,
                type: post.type,
                title: post.title,
                city: post.city,
              }
            : null,
          score: item.score,
          reason: item.reason,
        };
      }),
      hasMore:
        cached.length > page * RECOMMENDATIONS_PAGE_SIZE,
      llmReady: cached.some((row) => row.llm),
    };
  }

  const candidates = (await listPostsForMatching(user.id)).filter(
    (post) => post.authorId !== user.id,
  );
  const scored = candidates
    .map((post) => ({ post, detail: scorePostForUser(user, post) }))
    .sort((a, b) => b.detail.score - a.detail.score)
    .slice(0, RECOMMENDATIONS_CACHE_SIZE);

  // 写入规则结果缓存，让下一次访问秒回；失败不影响本次渲染。
  if (scored.length > 0) {
    await upsertRecommendations(
      user.id,
      scored.map((item) => ({
        postId: item.post.id,
        score: item.detail.score,
        reason: fallbackReason(item.detail),
        llm: false,
      })),
    ).catch(() => undefined);
  }

  const pageRows = scored.slice(
    (page - 1) * RECOMMENDATIONS_PAGE_SIZE,
    page * RECOMMENDATIONS_PAGE_SIZE,
  );
  return {
    items: pageRows.map((item) => ({
      post: {
        id: item.post.id,
        type: item.post.type,
        title: item.post.title,
        city: item.post.city,
      },
      score: item.detail.score,
      reason: fallbackReason(item.detail),
    })),
    hasMore: scored.length > page * RECOMMENDATIONS_PAGE_SIZE,
    llmReady: false,
  };
}

/**
 * 重新生成推荐（用户手动刷新或前端后台触发）：规则评分 → LLM 理由 →
 * 覆盖写入缓存（llm=true）。LLM 失败时保留规则文案。
 */
export async function refreshRecommendationsWithLlm(
  user: User,
): Promise<{ count: number }> {
  const candidates = (await listPostsForMatching(user.id)).filter(
    (post) => post.authorId !== user.id,
  );
  const scored = candidates
    .map((post) => ({ post, detail: scorePostForUser(user, post) }))
    .sort((a, b) => b.detail.score - a.detail.score)
    .slice(0, RECOMMENDATIONS_CACHE_SIZE);
  if (scored.length === 0) return { count: 0 };

  const llmReasons = await generateMatchReasons(
    user,
    scored.map((item) => item.post),
  ).catch((): Record<string, string> => ({}));

  await upsertRecommendations(
    user.id,
    scored.map((item) => ({
      postId: item.post.id,
      score: item.detail.score,
      reason: llmReasons[item.post.id] || fallbackReason(item.detail),
      llm: true,
    })),
  );
  return { count: scored.length };
}
