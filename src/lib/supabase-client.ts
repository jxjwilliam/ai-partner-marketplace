import { createClient } from "@supabase/supabase-js";

/**
 * 浏览器端 Supabase 客户端（发布密钥）。
 *
 * 仅用于邮箱魔法链接/登录的客户端侧调用；业务会话仍然使用自建
 * session token（localStorage + Authorization Bearer，iframe 安全）。
 * 这里不持久化 Supabase 会话、不自动刷新，避免在浏览器留下第二套凭据。
 */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase 客户端未配置：请检查 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
