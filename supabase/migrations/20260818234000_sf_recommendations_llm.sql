-- 推荐缓存标记：区分「规则评分结果」与「LLM 生成理由」。
-- 规则结果可秒出并写入缓存；llm=false 时前端会在后台触发一次 LLM 刷新。

ALTER TABLE "sf_recommendations"
    ADD COLUMN "llm" BOOLEAN NOT NULL DEFAULT false;
