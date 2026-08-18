"use client";

import { useEffect, useState } from "react";
import { apiFetch, setClientToken } from "@/lib/auth/client-session";
import { createBrowserSupabase } from "@/lib/supabase-client";

type ApiResponse = {
  ok?: boolean;
  token?: string;
  needsOnboarding?: boolean;
  error?: string;
};

/**
 * 邮箱魔法链接回调页。
 *
 * Supabase 把 access token 放在 URL hash（implicit flow）跳转到这里；
 * supabase-js 初始化时会自动解析并校验，我们只取会话、把 access token
 * 交给服务端换取应用自己的 session token（localStorage 持久化）。
 *
 * 两种进入方式：
 * - 邮箱魔法链接：当前页面整页跳转，完成后跳回目标页；
 * - Google OAuth 弹窗：由登录页 window.open 打开，完成登录后直接
 *   window.close()，登录页轮询 localStorage 检测到 token 后自行跳转。
 */
export default function AuthCallbackPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const next = params.get("next") || "/";

        const supabase = createBrowserSupabase();
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError || !session?.access_token) {
          throw new Error("登录链接无效或已过期，请重新获取");
        }

        const res = await apiFetch("/api/auth/supabase-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accessToken: session.access_token }),
        });
        const result = (await res.json()) as ApiResponse;
        if (!res.ok || !result.ok || !result.token) {
          throw new Error(result.error || "登录失败，请稍后重试");
        }

        setClientToken(result.token);
        // 清理临时 Supabase 会话（我们的 session token 已生效，不需要它）
        await supabase.auth.signOut().catch(() => undefined);

        if (cancelled) return;
        if (window.opener) {
          window.close();
          return;
        }
        window.location.assign(result.needsOnboarding ? "/onboarding" : next);
      } catch (err) {
        if (cancelled) return;
        if (window.opener) {
          window.close();
          return;
        }
        setError(
          err instanceof Error ? err.message : "登录失败，请稍后重试",
        );
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-6 py-16">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {loading ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              正在登录…
            </h1>
            <p className="mt-3 text-sm text-slate-500">请稍候，正在验证登录链接。</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              登录失败
            </h1>
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
            <a
              className="mt-6 inline-block rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white transition hover:bg-cyan-700"
              href="/login"
            >
              返回登录页
            </a>
          </>
        )}
      </section>
    </main>
  );
}
