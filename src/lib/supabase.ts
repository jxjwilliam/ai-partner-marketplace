import { createClient } from "@supabase/supabase-js";

/**
 * 服务端 Supabase 客户端（service_role）。
 * 仅允许在服务端使用；禁止把 service_role key 下发到浏览器。
 */
export function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase 未配置：请检查 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const supabase = createServerSupabase();
