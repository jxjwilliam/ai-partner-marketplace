-- 社区动态区（2026-08-18 修订）：动态 + 评论
-- 定位：资深技术人交流区；评论同时服务动态与帖子详情。
-- 权限与既有 sf_ 表一致：RLS 启用、无策略，仅 service_role 可读写。

CREATE TABLE "sf_community_posts" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sf_community_posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sf_comments" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "author_id" TEXT NOT NULL,
    "community_post_id" TEXT,
    "listing_post_id" TEXT,
    "body" TEXT NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sf_comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sf_comments_target_check" CHECK (
        ("community_post_id" IS NOT NULL)::INTEGER
        + ("listing_post_id" IS NOT NULL)::INTEGER = 1
    )
);

CREATE INDEX "sf_community_posts_created_at_idx"
    ON "sf_community_posts"("created_at" DESC);
CREATE INDEX "sf_comments_community_post_id_created_at_idx"
    ON "sf_comments"("community_post_id", "created_at");
CREATE INDEX "sf_comments_listing_post_id_created_at_idx"
    ON "sf_comments"("listing_post_id", "created_at");
CREATE INDEX "sf_comments_author_id_idx"
    ON "sf_comments"("author_id");

ALTER TABLE "sf_community_posts" ADD CONSTRAINT "sf_community_posts_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "sf_users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sf_comments" ADD CONSTRAINT "sf_comments_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "sf_users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sf_comments" ADD CONSTRAINT "sf_comments_community_post_id_fkey"
    FOREIGN KEY ("community_post_id") REFERENCES "sf_community_posts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sf_comments" ADD CONSTRAINT "sf_comments_listing_post_id_fkey"
    FOREIGN KEY ("listing_post_id") REFERENCES "sf_posts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "sf_community_posts", "sf_comments"
    TO "service_role";
ALTER TABLE "sf_community_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sf_comments" ENABLE ROW LEVEL SECURITY;
