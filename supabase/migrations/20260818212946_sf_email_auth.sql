-- 邮箱登录（Supabase Auth）：sf_users 关联 auth.users
-- phone 允许为空：邮箱注册用户没有手机号；手机号 OTP 用户保持原流程

ALTER TABLE "sf_users" ALTER COLUMN "phone" DROP NOT NULL;

-- auth_user_id 唯一关联 Supabase Auth 用户；删除 Auth 用户时仅解除关联，不删内容
ALTER TABLE "sf_users" ADD COLUMN "auth_user_id" UUID UNIQUE
    REFERENCES "auth"."users"("id") ON DELETE SET NULL;

-- 邮箱仅为展示/管理信息；唯一性由 auth.users 保证
ALTER TABLE "sf_users" ADD COLUMN "email" TEXT;
