"use client";

import { FormEvent, useState } from "react";
import { FILTER_CITIES } from "@/lib/constants";
import { apiFetch } from "@/lib/auth/client-session";

const ROLE_OPTIONS = [
  { value: "talent", label: "我是技术人" },
  { value: "founder", label: "我有项目" },
  { value: "investor", label: "我是投资人" },
  { value: "other", label: "其他" },
] as const;

const YEARS_OPTIONS = [
  { value: "", label: "选择经验年限" },
  { value: "5", label: "5 - 9 年" },
  { value: "10", label: "10 - 14 年" },
  { value: "15", label: "15 年以上" },
] as const;

type ApiResponse = {
  ok?: boolean;
  error?: string;
};

export default function OnboardingPage() {
  const [nickname, setNickname] = useState("");
  const [city, setCity] = useState("");
  const [roleTag, setRoleTag] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await apiFetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          city,
          roleTag,
          bio,
          skills: skills
            .split(/[,，]/)
            .map((item) => item.trim())
            .filter(Boolean),
          yearsExperience: yearsExperience || undefined,
        }),
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.ok) {
        setError(result.error ?? "保存失败，请稍后重试");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("网络连接失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:py-16">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-medium text-cyan-600">只需一分钟</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1F3A5F]">
          完善个人资料
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          让潜在合伙人快速了解你，也便于推荐更匹配的信息。
        </p>

        <form className="mt-8 space-y-7" onSubmit={submitProfile}>
          <label className="block text-sm font-medium text-slate-700">
            昵称
            <input
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={32}
              placeholder="怎么称呼你"
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            城市
            <select
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              required
            >
              <option value="" disabled>
                请选择常驻城市
              </option>
              {FILTER_CITIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            技能方向
            <span className="ml-2 font-normal text-slate-400">选填，逗号分隔</span>
            <input
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              value={skills}
              onChange={(event) => setSkills(event.target.value)}
              maxLength={120}
              placeholder="例如：AI大模型, 全栈, 架构师"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            经验年限
            <span className="ml-2 font-normal text-slate-400">选填</span>
            <select
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              value={yearsExperience}
              onChange={(event) => setYearsExperience(event.target.value)}
            >
              {YEARS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="text-sm font-medium text-slate-700">我的身份</legend>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ROLE_OPTIONS.map((option) => (
                <label
                  className={`cursor-pointer rounded-xl border px-4 py-3 text-sm transition ${
                    roleTag === option.value
                      ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                      : "border-slate-300 text-slate-700 hover:border-slate-400"
                  }`}
                  key={option.value}
                >
                  <input
                    className="mr-2 accent-cyan-600"
                    type="radio"
                    name="roleTag"
                    value={option.value}
                    checked={roleTag === option.value}
                    onChange={(event) => setRoleTag(event.target.value)}
                    required
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block text-sm font-medium text-slate-700">
            个人简介
            <span className="ml-2 font-normal text-slate-400">选填</span>
            <textarea
              className="mt-2 min-h-28 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={200}
              placeholder="介绍你的经历、擅长方向或正在寻找的机会"
            />
            <span className="mt-1 block text-right text-xs font-normal text-slate-400">
              {bio.length}/200
            </span>
          </label>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            className="w-full rounded-xl bg-[#1F3A5F] px-4 py-3 font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "正在保存…" : "保存并进入集市"}
          </button>
        </form>
      </section>
    </main>
  );
}
