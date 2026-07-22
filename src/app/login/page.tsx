"use client";

import { FormEvent, useState } from "react";

type ApiResponse = {
  ok?: boolean;
  error?: string;
  needsOnboarding?: boolean;
};

async function readResponse(response: Response): Promise<ApiResponse> {
  try {
    return (await response.json()) as ApiResponse;
  } catch {
    return {};
  }
}

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function sendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const result = await readResponse(response);
      if (!response.ok || !result.ok) {
        setError(result.error ?? "验证码发送失败，请稍后重试");
        return;
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
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const result = await readResponse(response);
      if (!response.ok || !result.ok) {
        setError(result.error ?? "登录失败，请稍后重试");
        return;
      }
      window.location.assign(result.needsOnboarding ? "/onboarding" : "/");
    } catch {
      setError("网络连接失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-6 py-16">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-3 text-sm font-medium text-indigo-600">AI合伙人集市</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">登录</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          使用手机号登录，寻找下一位事业合伙人。
        </p>

        {step === "phone" ? (
          <form className="mt-8 space-y-5" onSubmit={sendOtp}>
            <label className="block text-sm font-medium text-slate-700">
              手机号
              <input
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
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
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base tracking-[0.3em] text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
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
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-700"
                type="button"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setError("");
                }}
              >
                更换手机号（{phone}）
              </button>
            </div>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "正在登录…" : "登录"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
