"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  apiFetch,
  getClientToken,
  setClientToken,
} from "@/lib/auth/client-session";
import { createBrowserSupabase } from "@/lib/supabase-client";

type ApiResponse = {
  ok?: boolean;
  error?: string;
  needsOnboarding?: boolean;
  dryRun?: boolean;
  devCode?: string;
  token?: string;
};

async function readResponse(response: Response): Promise<ApiResponse> {
  try {
    return (await response.json()) as ApiResponse;
  } catch {
    return {};
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const [tab, setTab] = useState<"phone" | "email" | "google">("phone");

  // 手机号登录状态（原逻辑保持不变）
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 邮箱登录状态
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  // Google 登录状态（弹窗式）
  const [googleError, setGoogleError] = useState("");
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  // Already signed in (iframe localStorage session)? Skip the form.
  useEffect(() => {
    if (!getClientToken()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/me");
        if (cancelled || !res.ok) return;
        const next =
          new URLSearchParams(window.location.search).get("next") || "/";
        window.location.replace(next);
      } catch {
        // keep showing the form
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function sendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setHint("");
    setSubmitting(true);

    try {
      const response = await apiFetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const result = await readResponse(response);
      if (!response.ok || !result.ok) {
        setError(result.error ?? "验证码发送失败，请稍后重试");
        return;
      }
      if (result.dryRun && result.devCode) {
        setCode(result.devCode);
        setHint(`开发模式（未发短信）：验证码 ${result.devCode}`);
      }
      setStep("code");
    } catch {
      setError("网络连接失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await apiFetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const result = await readResponse(response);
      if (!response.ok || !result.ok) {
        setError(result.error ?? "登录失败，请稍后重试");
        return;
      }
      if (result.token) {
        setClientToken(result.token);
      }
      window.location.assign(result.needsOnboarding ? "/onboarding" : "/");
    } catch {
      setError("网络连接失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendEmailLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError("");
    setEmailSent(false);
    const value = email.trim();
    if (!EMAIL_PATTERN.test(value)) {
      setEmailError("请输入有效的邮箱地址");
      return;
    }
    setEmailSubmitting(true);

    try {
      const supabase = createBrowserSupabase();
      const next =
        new URLSearchParams(window.location.search).get("next") || "/";
      const { error } = await supabase.auth.signInWithOtp({
        email: value,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) {
        setEmailError(
          /60 seconds|too many|rate limit/i.test(error.message)
            ? "发送过于频繁，请 60 秒后重试"
            : "邮件发送失败，请稍后重试",
        );
        return;
      }
      setEmailSent(true);
    } catch {
      setEmailError("邮件发送失败，请稍后重试");
    } finally {
      setEmailSubmitting(false);
    }
  }

  async function startGoogleSignIn() {
    setGoogleError("");
    setGoogleSubmitting(true);
    try {
      const supabase = createBrowserSupabase();
      const next =
        new URLSearchParams(window.location.search).get("next") || "/";
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          skipBrowserRedirect: true,
        },
      });
      if (error || !data.url) {
        setGoogleError("Google 登录暂不可用，请稍后重试");
        return;
      }

      const popup = window.open(
        data.url,
        "google-oauth-popup",
        "width=520,height=640,popup=yes",
      );
      if (!popup) {
        setGoogleError("浏览器阻止了登录窗口，请允许弹窗后重试");
        return;
      }

      // 回调页（弹窗内）完成登录后会写入 localStorage 并关闭自身；
      // 这里轮询检测 token，成功后跳转目标页。
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        if (getClientToken()) {
          window.clearInterval(timer);
          popup.close();
          window.location.assign(next);
          return;
        }
        if (popup.closed) {
          window.clearInterval(timer);
          setGoogleSubmitting(false);
          if (!getClientToken()) {
            setGoogleError("登录未完成或已取消，请重试");
          }
        } else if (Date.now() - startedAt > 3 * 60_000) {
          window.clearInterval(timer);
          popup.close();
          setGoogleSubmitting(false);
          setGoogleError("登录超时，请重试");
        }
      }, 400);
    } catch {
      setGoogleError("Google 登录暂不可用，请稍后重试");
      setGoogleSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-6 py-16">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-3 text-sm font-medium text-cyan-600">AI合伙人集市</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">登录</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          使用手机号或邮箱登录，寻找下一位事业合伙人。
        </p>

        <div
          className="mt-6 grid grid-cols-3 rounded-xl bg-slate-100 p-1"
          role="tablist"
          aria-label="登录方式"
        >
          <button
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === "phone"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
            type="button"
            role="tab"
            aria-selected={tab === "phone"}
            onClick={() => setTab("phone")}
          >
            手机号登录
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === "email"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
            type="button"
            role="tab"
            aria-selected={tab === "email"}
            onClick={() => setTab("email")}
          >
            邮箱登录
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === "google"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
            type="button"
            role="tab"
            aria-selected={tab === "google"}
            onClick={() => setTab("google")}
          >
            Google 登录
          </button>
        </div>

        {tab === "phone" ? (
          <>
            {step === "phone" ? (
              <form className="mt-8 space-y-5" onSubmit={sendOtp}>
                <label className="block text-sm font-medium text-slate-700">
                  手机号
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="请输入手机号"
                    required
                  />
                </label>
                {error && (
                  <p className="text-sm text-red-600" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? "正在发送…" : "获取验证码"}
                </button>
              </form>
            ) : (
              <form className="mt-8 space-y-5" onSubmit={verifyOtp}>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    验证码
                    <input
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base tracking-[0.3em] text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="请输入 6 位验证码"
                      required
                      autoFocus
                    />
                  </label>
                  <button
                    className="mt-2 text-sm text-cyan-600 hover:text-cyan-700"
                    type="button"
                    onClick={() => {
                      setStep("phone");
                      setCode("");
                      setError("");
                      setHint("");
                    }}
                  >
                    更换手机号（{phone}）
                  </button>
                </div>
                {hint && (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {hint}
                  </p>
                )}
                {error && (
                  <p className="text-sm text-red-600" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? "正在登录…" : "登录"}
                </button>
              </form>
            )}
          </>
        ) : tab === "email" ? (
          <form className="mt-8 space-y-5" onSubmit={sendEmailLink}>
            <label className="block text-sm font-medium text-slate-700">
              邮箱
              <input
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                placeholder="请输入邮箱（例如 name@gmail.com）"
                required
              />
            </label>
            {emailError && (
              <p className="text-sm text-red-600" role="alert">
                {emailError}
              </p>
            )}
            {emailSent && (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                登录链接已发送到 {email.trim()}，请查收邮件并点击链接完成登录。
              </p>
            )}
            <button
              className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={emailSubmitting}
              type="submit"
            >
              {emailSubmitting ? "正在发送…" : "发送登录链接"}
            </button>
            <p className="text-xs leading-5 text-slate-400">
              首次登录会自动创建账号；未收到邮件时请检查垃圾邮件，或 60 秒后重试。
            </p>
          </form>
        ) : (
          <div className="mt-8 space-y-5">
            {googleError && (
              <p className="text-sm text-red-600" role="alert">
                {googleError}
              </p>
            )}
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={googleSubmitting}
              type="button"
              onClick={() => void startGoogleSignIn()}
            >
              {googleSubmitting
                ? "正在跳转 Google…"
                : "使用 Google 账号登录"}
            </button>
            <p className="text-xs leading-5 text-slate-400">
              使用你的 Gmail 账号登录；首次登录会自动创建账号。
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
