import { supabase } from "@/lib/supabase";
import {
  COMMUNITY_PAGE_SIZE,
  HOME_PAGE_SIZE,
  OTP_MAX_ATTEMPTS,
} from "@/lib/constants";
import { buildSearchClause } from "@/lib/posts/filters";
import type {
  ContactRequest,
  OtpCode,
  Post,
  PostStatus,
  PostType,
  RoleTag,
  Session,
  UnlockStatus,
  User,
} from "@/lib/types";

/* ── 行 → 领域对象映射（snake_case → camelCase，时间转 Date） ── */

type UserRow = {
  id: string;
  phone: string | null;
  auth_user_id: string | null;
  email: string | null;
  nickname: string | null;
  city: string | null;
  role_tag: RoleTag | null;
  bio: string | null;
  skills: string[] | null;
  years_experience: number | null;
  is_verified: boolean;
  is_admin: boolean;
  created_at: string;
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    phone: row.phone,
    authUserId: row.auth_user_id,
    email: row.email,
    nickname: row.nickname,
    city: row.city,
    roleTag: row.role_tag,
    bio: row.bio,
    skills: row.skills ?? [],
    yearsExperience: row.years_experience,
    isVerified: row.is_verified,
    isAdmin: row.is_admin,
    createdAt: new Date(row.created_at),
  };
}

type PostRow = {
  id: string;
  author_id: string;
  type: PostType;
  title: string;
  city: string;
  tags: string[] | null;
  body_json: Record<string, unknown>;
  contact_private: string;
  status: PostStatus;
  view_count: number;
  created_at: string;
  bumped_at: string;
};

function toPost(row: PostRow): Post {
  return {
    id: row.id,
    authorId: row.author_id,
    type: row.type,
    title: row.title,
    city: row.city,
    tags: row.tags ?? [],
    bodyJson: row.body_json ?? {},
    contactPrivate: row.contact_private,
    status: row.status,
    viewCount: row.view_count,
    createdAt: new Date(row.created_at),
    bumpedAt: new Date(row.bumped_at),
  };
}

type OtpRow = {
  id: string;
  phone: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  created_at: string;
  ip: string | null;
};

function toOtp(row: OtpRow): OtpCode {
  return {
    id: row.id,
    phone: row.phone,
    codeHash: row.code_hash,
    expiresAt: new Date(row.expires_at),
    attempts: row.attempts,
    createdAt: new Date(row.created_at),
    ip: row.ip,
  };
}

/* ── 用户 ── */

export async function getUserByPhone(phone: string): Promise<User | null> {
  const { data } = await supabase
    .from("sf_users")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();
  return data ? toUser(data as UserRow) : null;
}

export async function createUser(input: {
  phone: string;
  isAdmin: boolean;
}): Promise<User> {
  const { data, error } = await supabase
    .from("sf_users")
    .insert({ phone: input.phone, is_admin: input.isAdmin })
    .select("*")
    .single();
  if (error || !data) throw new Error("创建用户失败");
  return toUser(data as UserRow);
}

export async function getUserByAuthUserId(
  authUserId: string,
): Promise<User | null> {
  const { data } = await supabase
    .from("sf_users")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return data ? toUser(data as UserRow) : null;
}

/**
 * 邮箱登录时按 auth_user_id 查找或创建本地用户。
 * 并发首登时用唯一索引兜底：插入冲突则回查已有行。
 */
export async function findOrCreateAuthUser(input: {
  authUserId: string;
  email: string;
}): Promise<User> {
  const existing = await getUserByAuthUserId(input.authUserId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("sf_users")
    .insert({
      auth_user_id: input.authUserId,
      email: input.email,
      phone: null,
      is_admin: false,
    })
    .select("*")
    .single();
  if (error || !data) {
    const retry = await getUserByAuthUserId(input.authUserId);
    if (retry) return retry;
    throw new Error("创建用户失败");
  }
  return toUser(data as UserRow);
}

export async function updateUserProfile(
  userId: string,
  input: {
    nickname: string;
    city: string;
    roleTag: RoleTag;
    bio?: string;
    skills?: string[];
    yearsExperience?: number | null;
  },
): Promise<User> {
  const patch: Record<string, unknown> = {
    nickname: input.nickname,
    city: input.city,
    role_tag: input.roleTag,
  };
  if (input.bio !== undefined) patch.bio = input.bio;
  if (input.skills !== undefined) patch.skills = input.skills;
  if (input.yearsExperience !== undefined) {
    patch.years_experience = input.yearsExperience;
  }
  const { data, error } = await supabase
    .from("sf_users")
    .update(patch)
    .eq("id", userId)
    .select("*")
    .single();
  if (error || !data) throw new Error("保存资料失败");
  return toUser(data as UserRow);
}

/* ── 会话 ── */

export async function createSessionRow(input: {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
}): Promise<void> {
  const { error } = await supabase.from("sf_sessions").insert({
    token_hash: input.tokenHash,
    user_id: input.userId,
    expires_at: input.expiresAt.toISOString(),
  });
  if (error) throw new Error("创建会话失败");
}

export async function findSessionUser(
  tokenHash: string,
): Promise<{ session: Session; user: User } | null> {
  const { data } = await supabase
    .from("sf_sessions")
    .select("*,sf_users(*)")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return null;
  const session: Session = {
    id: data.id,
    tokenHash: data.token_hash,
    userId: data.user_id,
    expiresAt: new Date(data.expires_at),
    createdAt: new Date(data.created_at),
  };
  return { session, user: toUser(data.sf_users as UserRow) };
}

export async function deleteSessionRows(tokenHash: string): Promise<void> {
  await supabase.from("sf_sessions").delete().eq("token_hash", tokenHash);
}

/* ── OTP ── */

export async function findLatestOtp(phone: string): Promise<OtpCode | null> {
  const { data } = await supabase
    .from("sf_otp_codes")
    .select("*")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? toOtp(data as OtpRow) : null;
}

export async function countOtpCreatedSince(
  column: "phone" | "ip",
  value: string,
  since: Date,
): Promise<number> {
  const { count } = await supabase
    .from("sf_otp_codes")
    .select("id", { count: "exact", head: true })
    .eq(column, value)
    .gte("created_at", since.toISOString());
  return count ?? 0;
}

export async function createOtpRow(input: {
  phone: string;
  codeHash: string;
  expiresAt: Date;
  ip: string;
}): Promise<OtpCode> {
  const { data, error } = await supabase
    .from("sf_otp_codes")
    .insert({
      phone: input.phone,
      code_hash: input.codeHash,
      expires_at: input.expiresAt.toISOString(),
      ip: input.ip,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error("创建验证码失败");
  return toOtp(data as OtpRow);
}

export async function deleteOtpRow(id: string): Promise<void> {
  await supabase.from("sf_otp_codes").delete().eq("id", id);
}

export async function incrementOtpAttempts(id: string): Promise<number> {
  const { data } = await supabase
    .from("sf_otp_codes")
    .select("attempts")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.attempts >= OTP_MAX_ATTEMPTS) return OTP_MAX_ATTEMPTS;
  const { data: updated } = await supabase
    .from("sf_otp_codes")
    .update({ attempts: data.attempts + 1 })
    .eq("id", id)
    .select("id");
  return (updated?.length ?? 0) > 0 ? data.attempts + 1 : OTP_MAX_ATTEMPTS;
}

/** 仅在尝试次数未超限时消费验证码；返回是否消费成功。 */
export async function consumeOtpRow(id: string): Promise<boolean> {
  const { data } = await supabase
    .from("sf_otp_codes")
    .delete()
    .eq("id", id)
    .lt("attempts", OTP_MAX_ATTEMPTS)
    .select("id");
  return (data?.length ?? 0) > 0;
}

/* ── 帖子 ── */

export type PostListItem = {
  id: string;
  type: PostType;
  title: string;
  city: string;
  tags: string[];
  bodyJson: Record<string, unknown>;
  viewCount: number;
  createdAt: Date;
  bumpedAt: Date;
  author: {
    id: string;
    nickname: string | null;
    city: string | null;
    roleTag: RoleTag | null;
    isVerified: boolean;
  } | null;
};

function postRowToListItem(
  row: PostRow & {
    sf_users: {
      id: string;
      nickname: string | null;
      city: string | null;
      role_tag: RoleTag | null;
      is_verified: boolean;
    } | null;
  },
): PostListItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    city: row.city,
    tags: row.tags ?? [],
    bodyJson: row.body_json ?? {},
    viewCount: row.view_count,
    createdAt: new Date(row.created_at),
    bumpedAt: new Date(row.bumped_at),
    author: row.sf_users
      ? {
          id: row.sf_users.id,
          nickname: row.sf_users.nickname,
          city: row.sf_users.city,
          roleTag: row.sf_users.role_tag,
          isVerified: row.sf_users.is_verified,
        }
      : null,
  };
}

export async function listPosts(input: {
  city?: string;
  type?: PostType;
  tags?: string[];
  search?: string;
  sort: "latest" | "hot";
  page: number;
}): Promise<{ posts: PostListItem[]; hasMore: boolean }> {
  const pageSize = HOME_PAGE_SIZE;
  const base =
    "id,author_id,type,title,city,tags,body_json,view_count,status,created_at,bumped_at," +
    "sf_users!sf_posts_author_id_fkey(id,nickname,city,role_tag,is_verified)";

  let query = supabase.from("sf_posts").select(base).eq("status", "active");
  if (input.city) query = query.eq("city", input.city);
  if (input.type) query = query.eq("type", input.type);
  for (const tag of input.tags ?? []) {
    query = query.contains("tags", [tag]);
  }
  const searchClause = input.search ? buildSearchClause(input.search) : null;
  if (searchClause) query = query.or(searchClause);
  if (input.sort === "hot") {
    query = query.order("view_count", { ascending: false });
  }
  query = query.order("bumped_at", { ascending: false });
  query = query.range(
    (input.page - 1) * pageSize,
    input.page * pageSize,
  );

  const { data, error } = await query;
  if (error) throw new Error("查询帖子失败");
  const rows = (data ?? []) as unknown as Array<
    PostRow & {
      sf_users: {
        id: string;
        nickname: string | null;
        city: string | null;
        role_tag: RoleTag | null;
        is_verified: boolean;
      } | null;
    }
  >;
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  return { posts: pageRows.map(postRowToListItem), hasMore };
}

export async function getPostsByIds(ids: string[]): Promise<PostListItem[]> {
  if (ids.length === 0) return [];
  const base =
    "id,author_id,type,title,city,tags,body_json,view_count,status,created_at,bumped_at," +
    "sf_users!sf_posts_author_id_fkey(id,nickname,city,role_tag,is_verified)";
  const { data, error } = await supabase
    .from("sf_posts")
    .select(base)
    .in("id", ids)
    .eq("status", "active");
  if (error) throw new Error("查询帖子失败");
  return ((data ?? []) as unknown as Array<
    PostRow & {
      sf_users: {
        id: string;
        nickname: string | null;
        city: string | null;
        role_tag: RoleTag | null;
        is_verified: boolean;
      } | null;
    }
  >).map(postRowToListItem);
}

export async function listPostsForMatching(
  userId: string,
  limit = 100,
): Promise<
  Array<{
    id: string;
    authorId: string;
    type: PostType;
    title: string;
    city: string;
    tags: string[];
    bodyJson: Record<string, unknown>;
  }>
> {
  const { data } = await supabase
    .from("sf_posts")
    .select("id,author_id,type,title,city,tags,body_json")
    .eq("status", "active")
    .neq("author_id", userId)
    .order("bumped_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as Array<{
    id: string;
    author_id: string;
    type: PostType;
    title: string;
    city: string;
    tags: string[] | null;
    body_json: Record<string, unknown>;
  }>).map((row) => ({
    id: row.id,
    authorId: row.author_id,
    type: row.type,
    title: row.title,
    city: row.city,
    tags: row.tags ?? [],
    bodyJson: row.body_json ?? {},
  }));
}

/* ── AI 匹配推荐缓存 ── */

export type CachedRecommendation = {
  postId: string;
  score: number;
  reason: string;
  llm: boolean;
};

export async function getCachedRecommendations(
  userId: string,
  since: Date,
  limit = 6,
): Promise<CachedRecommendation[]> {
  const { data } = await supabase
    .from("sf_recommendations")
    .select("post_id,score,reason,llm")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString())
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as Array<{
    post_id: string;
    score: number;
    reason: string;
    llm: boolean;
  }>).map((row) => ({
    postId: row.post_id,
    score: Number(row.score) || 0,
    reason: row.reason ?? "",
    llm: Boolean(row.llm),
  }));
}

export async function getRecommendationForPost(
  userId: string,
  postId: string,
): Promise<CachedRecommendation | null> {
  const { data } = await supabase
    .from("sf_recommendations")
    .select("post_id,score,reason,llm")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .maybeSingle();
  if (!data) return null;
  return {
    postId: data.post_id,
    score: Number(data.score) || 0,
    reason: data.reason ?? "",
    llm: Boolean((data as { llm?: boolean }).llm),
  };
}

export async function upsertRecommendations(
  userId: string,
  rows: Array<{ postId: string; score: number; reason: string; llm?: boolean }>,
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("sf_recommendations")
    .upsert(
      rows.map((row) => ({
        user_id: userId,
        post_id: row.postId,
        score: row.score,
        reason: row.reason,
        llm: row.llm ?? false,
        // 刷新生成时间，避免 upsert 只更新内容、TTL 却永远停留在旧行
        created_at: new Date().toISOString(),
      })),
      { onConflict: "user_id,post_id" },
    );
  if (error) throw new Error("保存推荐失败");
}

export async function clearUserRecommendations(userId: string): Promise<void> {
  await supabase
    .from("sf_recommendations")
    .delete()
    .eq("user_id", userId);
}

export async function countPostsByType(): Promise<Record<PostType, number>> {
  const { data, error } = await supabase.rpc("sf_post_counts");
  if (error) throw new Error("统计帖子失败");
  const result: Record<PostType, number> = {
    partner: 0,
    talent: 0,
    project: 0,
    funding: 0,
  };
  for (const row of (data ?? []) as Array<{ type: PostType; cnt: number }>) {
    if (row.type in result) result[row.type] = Number(row.cnt) || 0;
  }
  return result;
}

export async function getPostById(
  id: string,
): Promise<(Post & { author: User | null }) | null> {
  const { data } = await supabase
    .from("sf_posts")
    .select("*,sf_users!sf_posts_author_id_fkey(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    ...toPost(data as PostRow),
    author: data.sf_users ? toUser(data.sf_users as UserRow) : null,
  };
}

export async function getPostAuthor(id: string): Promise<{
  authorId: string;
  status: PostStatus;
} | null> {
  const { data } = await supabase
    .from("sf_posts")
    .select("author_id,status")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return { authorId: data.author_id, status: data.status };
}

export async function incrementPostViews(id: string): Promise<number> {
  const { data, error } = await supabase.rpc("sf_increment_view", {
    p_post_id: id,
  });
  if (error) throw new Error("更新浏览量失败");
  return Number(data) || 0;
}

export async function createPost(input: {
  authorId: string;
  type: PostType;
  title: string;
  city: string;
  tags: string[];
  contactPrivate: string;
  body: Record<string, unknown>;
}): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("sf_posts")
    .insert({
      author_id: input.authorId,
      type: input.type,
      title: input.title,
      city: input.city,
      tags: input.tags,
      body_json: input.body,
      contact_private: input.contactPrivate,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("发布失败");
  return { id: data.id };
}

export async function updatePostStatusOrBump(
  id: string,
  input: { hide?: boolean; bump?: boolean },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.hide) patch.status = "hidden";
  if (input.bump) patch.bumped_at = new Date().toISOString();
  const { error } = await supabase
    .from("sf_posts")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error("更新帖子失败");
}

export async function listMyPosts(userId: string): Promise<
  Array<{ id: string; title: string; status: PostStatus; bumpedAt: Date }>
> {
  const { data } = await supabase
    .from("sf_posts")
    .select("id,title,status,bumped_at")
    .eq("author_id", userId)
    .order("bumped_at", { ascending: false });
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    bumpedAt: new Date(row.bumped_at),
  }));
}

/* ── 联系方式解锁 ── */

export async function getUnlockStatus(
  postId: string,
  requesterId: string,
): Promise<UnlockStatus | null> {
  const { data } = await supabase
    .from("sf_contact_requests")
    .select("status")
    .eq("post_id", postId)
    .eq("requester_id", requesterId)
    .maybeSingle();
  return data?.status ?? null;
}

export async function countPendingUnlocksToday(
  requesterId: string,
  since: Date,
): Promise<number> {
  const { count } = await supabase
    .from("sf_contact_requests")
    .select("id", { count: "exact", head: true })
    .eq("requester_id", requesterId)
    .eq("status", "pending")
    .gte("created_at", since.toISOString());
  return count ?? 0;
}

export async function createUnlockRequest(
  postId: string,
  requesterId: string,
  message: string,
): Promise<ContactRequest> {
  const { data, error } = await supabase
    .from("sf_contact_requests")
    .insert({ post_id: postId, requester_id: requesterId, message })
    .select("*")
    .single();
  if (error || !data) throw new Error("创建申请失败");
  return {
    id: data.id,
    postId: data.post_id,
    requesterId: data.requester_id,
    message: data.message,
    status: data.status,
    createdAt: new Date(data.created_at),
    decidedAt: data.decided_at ? new Date(data.decided_at) : null,
  };
}

/** 被拒绝的申请允许重新提交（复用唯一行，重新置为 pending）。 */
export async function reopenUnlockRequest(
  postId: string,
  requesterId: string,
  message: string,
): Promise<ContactRequest> {
  const { data, error } = await supabase
    .from("sf_contact_requests")
    .update({
      message,
      status: "pending",
      decided_at: null,
      created_at: new Date().toISOString(),
    })
    .eq("post_id", postId)
    .eq("requester_id", requesterId)
    .select("*")
    .single();
  if (error || !data) throw new Error("重新提交申请失败");
  return {
    id: data.id,
    postId: data.post_id,
    requesterId: data.requester_id,
    message: data.message,
    status: data.status,
    createdAt: new Date(data.created_at),
    decidedAt: data.decided_at ? new Date(data.decided_at) : null,
  };
}

export async function getUnlockRequest(requestId: string): Promise<{
  id: string;
  status: UnlockStatus;
  post: { authorId: string };
} | null> {
  const { data } = await supabase
    .from("sf_contact_requests")
    .select("id,status,sf_posts!sf_contact_requests_post_id_fkey(author_id)")
    .eq("id", requestId)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as {
    id: string;
    status: UnlockStatus;
    sf_posts?: { author_id?: string } | null;
  };
  return {
    id: row.id,
    status: row.status,
    post: { authorId: row.sf_posts?.author_id ?? "" },
  };
}

export async function decideUnlockRequest(
  requestId: string,
  status: "approved" | "rejected",
): Promise<boolean> {
  const { data } = await supabase
    .from("sf_contact_requests")
    .update({ status, decided_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id");
  return (data?.length ?? 0) > 0;
}

export async function listIncomingUnlocks(userId: string): Promise<
  Array<{
    id: string;
    message: string;
    createdAt: Date;
    requesterName: string | null;
    postTitle: string;
  }>
> {
  const { data } = await supabase
    .from("sf_contact_requests")
    .select(
      "id,message,created_at,sf_users!sf_contact_requests_requester_id_fkey(nickname),sf_posts!sf_contact_requests_post_id_fkey(title)",
    )
    .eq("status", "pending")
    .eq("sf_posts.author_id", userId)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    message: string;
    created_at: string;
    sf_users?: { nickname?: string | null } | null;
    sf_posts?: { title?: string } | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    message: row.message,
    createdAt: new Date(row.created_at),
    requesterName: row.sf_users?.nickname ?? null,
    postTitle: row.sf_posts?.title ?? "",
  }));
}

export async function listOutgoingUnlocks(userId: string): Promise<
  Array<{
    id: string;
    status: UnlockStatus;
    createdAt: Date;
    post: {
      id: string;
      title: string;
      authorId: string;
      contactPrivate: string;
      authorName: string | null;
    } | null;
  }>
> {
  const { data } = await supabase
    .from("sf_contact_requests")
    .select(
      "id,status,created_at,sf_posts!sf_contact_requests_post_id_fkey(id,title,author_id,contact_private,sf_users!sf_posts_author_id_fkey(nickname))",
    )
    .eq("requester_id", userId)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    status: UnlockStatus;
    created_at: string;
    sf_posts?: {
      id: string;
      title: string;
      author_id: string;
      contact_private: string;
      sf_users?: { nickname?: string | null } | null;
    } | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: new Date(row.created_at),
    post: row.sf_posts
      ? {
          id: row.sf_posts.id,
          title: row.sf_posts.title,
          authorId: row.sf_posts.author_id,
          contactPrivate: row.sf_posts.contact_private,
          authorName: row.sf_posts.sf_users?.nickname ?? null,
        }
      : null,
  }));
}

/* ── 社区动态区（2026-08-18 修订） ── */

export type CommunityAuthor = {
  id: string;
  nickname: string | null;
  city: string | null;
  roleTag: RoleTag | null;
  isVerified: boolean;
};

export type CommunityComment = {
  id: string;
  authorId: string;
  body: string;
  createdAt: Date;
  author: CommunityAuthor | null;
};

export type CommunityPost = {
  id: string;
  authorId: string;
  body: string;
  createdAt: Date;
  author: CommunityAuthor | null;
  comments: CommunityComment[];
};

type CommunityAuthorRow = {
  id: string;
  nickname: string | null;
  city: string | null;
  role_tag: RoleTag | null;
  is_verified: boolean;
};

const COMMUNITY_AUTHOR_SELECT =
  "id,nickname,city,role_tag,is_verified";

function toCommunityAuthor(row: CommunityAuthorRow | null): CommunityAuthor | null {
  if (!row) return null;
  return {
    id: row.id,
    nickname: row.nickname,
    city: row.city,
    roleTag: row.role_tag,
    isVerified: row.is_verified,
  };
}

export async function getCommunityPost(id: string): Promise<{
  id: string;
  authorId: string;
  status: PostStatus;
} | null> {
  const { data } = await supabase
    .from("sf_community_posts")
    .select("id,author_id,status")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, authorId: data.author_id, status: data.status };
}

export async function listCommunityPosts(input: {
  page: number;
}): Promise<{ posts: CommunityPost[]; hasMore: boolean }> {
  const pageSize = COMMUNITY_PAGE_SIZE;
  const postSelect = `id,author_id,body,created_at,sf_users!sf_community_posts_author_id_fkey(${COMMUNITY_AUTHOR_SELECT})`;
  const commentSelect = `id,author_id,community_post_id,body,created_at,sf_users!sf_comments_author_id_fkey(${COMMUNITY_AUTHOR_SELECT})`;

  const [postQuery, commentQuery] = await Promise.all([
    supabase
      .from("sf_community_posts")
      .select(postSelect)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .range((input.page - 1) * pageSize, input.page * pageSize),
    supabase
      .from("sf_comments")
      .select(commentSelect)
      .eq("status", "active"),
  ]);

  const postRows = (postQuery.data ?? []) as unknown as Array<{
    id: string;
    author_id: string;
    body: string;
    created_at: string;
    sf_users?: CommunityAuthorRow | null;
  }>;
  const hasMore = postRows.length > pageSize;
  const pageRows = hasMore ? postRows.slice(0, pageSize) : postRows;
  const postIds = new Set(pageRows.map((row) => row.id));

  const commentRows = (commentQuery.data ?? []) as unknown as Array<{
    id: string;
    author_id: string;
    community_post_id: string | null;
    body: string;
    created_at: string;
    sf_users?: CommunityAuthorRow | null;
  }>;
  const commentsByPost = new Map<string, CommunityComment[]>();
  for (const row of commentRows) {
    if (!row.community_post_id || !postIds.has(row.community_post_id)) continue;
    const item: CommunityComment = {
      id: row.id,
      authorId: row.author_id,
      body: row.body,
      createdAt: new Date(row.created_at),
      author: toCommunityAuthor(row.sf_users ?? null),
    };
    const list = commentsByPost.get(row.community_post_id) ?? [];
    list.push(item);
    commentsByPost.set(row.community_post_id, list);
  }

  const posts = pageRows.map((row) => ({
    id: row.id,
    authorId: row.author_id,
    body: row.body,
    createdAt: new Date(row.created_at),
    author: toCommunityAuthor(row.sf_users ?? null),
    comments: (commentsByPost.get(row.id) ?? []).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    ),
  }));
  return { posts, hasMore };
}

export async function createCommunityPost(
  authorId: string,
  body: string,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("sf_community_posts")
    .insert({ author_id: authorId, body })
    .select("id")
    .single();
  if (error || !data) throw new Error("发布动态失败");
  return { id: data.id };
}

export async function deleteCommunityPost(
  id: string,
  authorId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("sf_community_posts")
    .delete()
    .eq("id", id)
    .eq("author_id", authorId)
    .select("id");
  return (data?.length ?? 0) > 0;
}

export async function listCommentsForListingPost(
  listingPostId: string,
): Promise<CommunityComment[]> {
  const { data } = await supabase
    .from("sf_comments")
    .select(
      `id,author_id,body,created_at,sf_users!sf_comments_author_id_fkey(${COMMUNITY_AUTHOR_SELECT})`,
    )
    .eq("listing_post_id", listingPostId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  return ((data ?? []) as unknown as Array<{
    id: string;
    author_id: string;
    body: string;
    created_at: string;
    sf_users?: CommunityAuthorRow | null;
  }>).map((row) => ({
    id: row.id,
    authorId: row.author_id,
    body: row.body,
    createdAt: new Date(row.created_at),
    author: toCommunityAuthor(row.sf_users ?? null),
  }));
}

export async function createComment(input: {
  authorId: string;
  communityPostId?: string;
  listingPostId?: string;
  body: string;
}): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("sf_comments")
    .insert({
      author_id: input.authorId,
      community_post_id: input.communityPostId ?? null,
      listing_post_id: input.listingPostId ?? null,
      body: input.body,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("发表评论失败");
  return { id: data.id };
}

export async function deleteComment(
  id: string,
  authorId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("sf_comments")
    .delete()
    .eq("id", id)
    .eq("author_id", authorId)
    .select("id");
  return (data?.length ?? 0) > 0;
}

export async function countCommunityPostsSince(
  userId: string,
  since: Date,
): Promise<number> {
  const { count } = await supabase
    .from("sf_community_posts")
    .select("id", { count: "exact", head: true })
    .eq("author_id", userId)
    .gte("created_at", since.toISOString());
  return count ?? 0;
}

export async function countCommentsSince(
  userId: string,
  since: Date,
): Promise<number> {
  const { count } = await supabase
    .from("sf_comments")
    .select("id", { count: "exact", head: true })
    .eq("author_id", userId)
    .gte("created_at", since.toISOString());
  return count ?? 0;
}
