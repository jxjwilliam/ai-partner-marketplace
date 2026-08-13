-- AI合伙人集市（senior-fusion-platform）Supabase schema
-- 所有表统一 sf_ 前缀；RLS 默认拒绝匿名访问，仅 service_role 可读写。

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "RoleTag" AS ENUM ('talent', 'founder', 'investor', 'other');
CREATE TYPE "PostType" AS ENUM ('partner', 'talent', 'project', 'funding');
CREATE TYPE "PostStatus" AS ENUM ('active', 'hidden');
CREATE TYPE "UnlockStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "sf_users" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "phone" TEXT NOT NULL,
    "nickname" TEXT,
    "city" TEXT,
    "role_tag" "RoleTag",
    "bio" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "years_experience" INTEGER,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sf_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sf_otp_codes" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    CONSTRAINT "sf_otp_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sf_sessions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sf_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sf_posts" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "author_id" TEXT NOT NULL,
    "type" "PostType" NOT NULL,
    "title" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "tags" TEXT[],
    "body_json" JSONB NOT NULL,
    "contact_private" TEXT NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'active',
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bumped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sf_posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sf_contact_requests" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "post_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "UnlockStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    CONSTRAINT "sf_contact_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sf_users_phone_key" ON "sf_users"("phone");
CREATE INDEX "sf_otp_codes_phone_created_at_idx" ON "sf_otp_codes"("phone", "created_at");
CREATE UNIQUE INDEX "sf_sessions_token_hash_key" ON "sf_sessions"("token_hash");
CREATE INDEX "sf_posts_status_bumped_at_idx" ON "sf_posts"("status", "bumped_at");
CREATE INDEX "sf_posts_type_city_idx" ON "sf_posts"("type", "city");
CREATE INDEX "sf_contact_requests_requester_id_status_created_at_idx"
    ON "sf_contact_requests"("requester_id", "status", "created_at");
CREATE UNIQUE INDEX "sf_contact_requests_post_id_requester_id_key"
    ON "sf_contact_requests"("post_id", "requester_id");

ALTER TABLE "sf_sessions" ADD CONSTRAINT "sf_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "sf_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sf_posts" ADD CONSTRAINT "sf_posts_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "sf_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sf_contact_requests" ADD CONSTRAINT "sf_contact_requests_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "sf_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sf_contact_requests" ADD CONSTRAINT "sf_contact_requests_requester_id_fkey"
    FOREIGN KEY ("requester_id") REFERENCES "sf_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 权限：仅 service_role 可读写（RLS 默认拒绝，service_role 绕过 RLS）
GRANT SELECT, INSERT, UPDATE, DELETE ON "sf_users", "sf_otp_codes", "sf_sessions",
    "sf_posts", "sf_contact_requests" TO "service_role";
ALTER TABLE "sf_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sf_otp_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sf_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sf_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sf_contact_requests" ENABLE ROW LEVEL SECURITY;

-- 分类卡片实时数量（服务端 RPC）
CREATE OR REPLACE FUNCTION "sf_post_counts"()
RETURNS TABLE("type" "PostType", "cnt" BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT p."type" AS "type", COUNT(*)::BIGINT AS "cnt"
  FROM "sf_posts" p
  WHERE p."status" = 'active'
  GROUP BY p."type"
$$;
GRANT EXECUTE ON FUNCTION "sf_post_counts"() TO "service_role";

-- 帖子浏览量自增（服务端 RPC）
CREATE OR REPLACE FUNCTION "sf_increment_view"(p_post_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE "sf_posts"
  SET "view_count" = "view_count" + 1
  WHERE "id" = p_post_id
  RETURNING "view_count" INTO v_count;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION "sf_increment_view"(TEXT) TO "service_role";
