-- AI 匹配推荐缓存（每用户每帖一条，TTL 由应用控制）
CREATE TABLE "sf_recommendations" (
    "user_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sf_recommendations_pkey" PRIMARY KEY ("user_id", "post_id")
);

CREATE INDEX "sf_recommendations_user_id_created_at_idx"
    ON "sf_recommendations"("user_id", "created_at");

ALTER TABLE "sf_recommendations" ADD CONSTRAINT "sf_recommendations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "sf_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sf_recommendations" ADD CONSTRAINT "sf_recommendations_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "sf_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "sf_recommendations" TO "service_role";
ALTER TABLE "sf_recommendations" ENABLE ROW LEVEL SECURITY;
