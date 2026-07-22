"use client";

import { FormEvent, useState } from "react";
import AiPolishBlock from "@/components/AiPolishBlock";
import { FILTER_CITIES, POST_TYPE_LABEL, TAGS } from "@/lib/constants";

type PostType = "partner" | "talent" | "project" | "funding";
type Values = Record<string, string>;

const POST_TYPES: PostType[] = ["partner", "talent", "project", "funding"];
const TYPE_DESCRIPTIONS: Record<PostType, string> = {
  partner: "寻找志同道合的创业伙伴",
  talent: "展示能力，寻找合作机会",
  project: "发布项目需求，寻找服务人才",
  funding: "介绍项目，寻找资金支持",
};
const MODE_OPTIONS = ["股权合伙", "兼职合作", "全职加入", "项目制"] as const;
const BODY_LABELS: Record<string, string> = {
  projectStage: "项目阶段",
  intro: "项目简介",
  techNeeds: "技术需求",
  cooperationModes: "合作方式",
  equitySalary: "股权或薪资",
  currentTeam: "当前团队",
  status: "当前状态",
  background: "个人背景",
  timeCommitment: "可投入时间",
  desiredModes: "期望合作方式",
  portfolio: "作品集",
  projectKind: "项目类型",
  workMode: "合作模式",
  budget: "预算",
  duration: "预计周期",
  stage: "融资阶段",
  amount: "融资金额",
  team: "团队介绍",
  equity: "出让股权",
};

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

export default function PostForm({ defaultCity = "" }: { defaultCity?: string }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [type, setType] = useState<PostType | null>(null);
  const [title, setTitle] = useState("");
  const [city, setCity] = useState(defaultCity);
  const [tags, setTags] = useState<string[]>([]);
  const [contactPrivate, setContactPrivate] = useState("");
  const [values, setValues] = useState<Values>({});
  const [modes, setModes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function chooseType(nextType: PostType) {
    setType(nextType);
    setValues({});
    setModes([]);
    setStep(2);
  }

  function setValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function adoptPolished(polished: Values) {
    if (polished.title) setTitle(polished.title);
    setValues((current) => {
      const next = { ...current };
      for (const key of Object.keys(current)) {
        if (polished[key] !== undefined) next[key] = polished[key];
      }
      return next;
    });
  }

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  }

  function toggleMode(mode: string) {
    setModes((current) =>
      current.includes(mode)
        ? current.filter((item) => item !== mode)
        : [...current, mode],
    );
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tags.length || !modesAreValid()) {
      setError(!tags.length ? "请至少选择一个标签" : "请至少选择一种合作方式");
      return;
    }
    setError("");
    setStep(3);
  }

  function modesAreValid() {
    return type === "project" || type === "funding" || modes.length > 0;
  }

  function bodyForType() {
    switch (type) {
      case "partner":
        return {
          projectStage: values.projectStage,
          intro: values.intro,
          techNeeds: values.techNeeds,
          cooperationModes: modes,
          equitySalary: values.equitySalary || undefined,
          currentTeam: values.currentTeam || undefined,
        };
      case "talent":
        return {
          status: values.status,
          background: values.background,
          timeCommitment: values.timeCommitment,
          desiredModes: modes,
          portfolio: values.portfolio || undefined,
        };
      case "project":
        return {
          projectKind: values.projectKind,
          techNeeds: values.techNeeds,
          workMode: values.workMode,
          budget: values.budget || undefined,
          duration: values.duration || undefined,
        };
      case "funding":
        return {
          stage: values.stage,
          amount: values.amount,
          intro: values.intro,
          team: values.team,
          equity: values.equity || undefined,
        };
      default:
        return {};
    }
  }

  async function publish() {
    if (!type) return;
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          title,
          city,
          tags,
          contactPrivate,
          body: bodyForType(),
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        id?: string;
        error?: string;
      };
      if (!response.ok || !result.ok || !result.id) {
        setError(result.error ?? "发布失败，请稍后重试");
        return;
      }
      window.location.assign(`/posts/${result.id}`);
    } catch {
      setError("网络连接失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  function textField(
    name: string,
    label: string,
    options?: { optional?: boolean; multiline?: boolean; maxLength?: number },
  ) {
    const Input = options?.multiline ? "textarea" : "input";
    return (
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {options?.optional && (
          <span className="ml-2 font-normal text-slate-400">选填</span>
        )}
        <Input
          className={`${inputClass} ${options?.multiline ? "min-h-28 resize-y" : ""}`}
          value={values[name] ?? ""}
          onChange={(event) => setValue(name, event.target.value)}
          maxLength={options?.maxLength}
          required={!options?.optional}
        />
      </label>
    );
  }

  function modeChoices(label: string) {
    return (
      <fieldset>
        <legend className="text-sm font-medium text-slate-700">{label}</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {MODE_OPTIONS.map((mode) => (
            <button
              className={`rounded-full border px-4 py-2 text-sm transition ${
                modes.includes(mode)
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-slate-300 text-slate-600 hover:border-slate-400"
              }`}
              key={mode}
              type="button"
              onClick={() => toggleMode(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  function typeFields() {
    switch (type) {
      case "partner":
        return (
          <>
            {textField("projectStage", "项目阶段")}
            {textField("intro", "项目简介", { multiline: true, maxLength: 300 })}
            {textField("techNeeds", "技术需求", { multiline: true, maxLength: 200 })}
            {modeChoices("合作方式")}
            {textField("equitySalary", "股权或薪资说明", { optional: true })}
            {textField("currentTeam", "当前团队", { optional: true })}
          </>
        );
      case "talent":
        return (
          <>
            {textField("status", "当前状态")}
            {textField("background", "个人背景", { multiline: true, maxLength: 300 })}
            {textField("timeCommitment", "可投入时间")}
            {modeChoices("期望合作方式")}
            {textField("portfolio", "作品集或个人主页", { optional: true })}
          </>
        );
      case "project":
        return (
          <>
            {textField("projectKind", "项目类型")}
            {textField("techNeeds", "技术需求", { multiline: true, maxLength: 300 })}
            {textField("workMode", "合作模式")}
            {textField("budget", "预算", { optional: true })}
            {textField("duration", "预计周期", { optional: true })}
          </>
        );
      case "funding":
        return (
          <>
            {textField("stage", "融资阶段")}
            {textField("amount", "融资金额")}
            {textField("intro", "项目简介", { multiline: true, maxLength: 300 })}
            {textField("team", "团队介绍", { multiline: true, maxLength: 200 })}
            {textField("equity", "出让股权", { optional: true })}
          </>
        );
      default:
        return null;
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <ol className="mb-10 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
        {["选择发布类型", "填写信息", "预览并发布"].map((label, index) => (
          <li
            className={`rounded-full px-2 py-2 ${
              step === index + 1
                ? "bg-indigo-600 font-semibold text-white"
                : "bg-slate-100 text-slate-500"
            }`}
            key={label}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            你想发布什么？
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            选择最符合当前需求的类型，之后可以预览再发布。
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {POST_TYPES.map((item) => (
              <button
                className="rounded-2xl border border-slate-200 p-5 text-left transition hover:border-indigo-400 hover:bg-indigo-50"
                key={item}
                type="button"
                onClick={() => chooseType(item)}
              >
                <span className="block text-lg font-semibold text-slate-900">
                  {POST_TYPE_LABEL[item]}
                </span>
                <span className="mt-2 block text-sm text-slate-500">
                  {TYPE_DESCRIPTIONS[item]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && type && (
        <form className="space-y-6" onSubmit={review}>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              填写{POST_TYPE_LABEL[type]}信息
            </h1>
            <button
              className="mt-2 text-sm text-indigo-600 hover:text-indigo-700"
              type="button"
              onClick={() => setStep(1)}
            >
              更换发布类型
            </button>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            标题
            <input
              className={inputClass}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={50}
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            城市
            <select
              className={inputClass}
              value={city}
              onChange={(event) => setCity(event.target.value)}
              required
            >
              <option value="" disabled>
                请选择城市
              </option>
              {FILTER_CITIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          {typeFields()}

          <AiPolishBlock
            type={type}
            fields={{ title, ...values }}
            onAdopt={adoptPolished}
          />

          <fieldset>
            <legend className="text-sm font-medium text-slate-700">
              标签（至少选择一个）
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {TAGS.map((tag) => (
                <button
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    tags.includes(tag)
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-slate-300 text-slate-600 hover:border-slate-400"
                  }`}
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block text-sm font-medium text-slate-700">
            私密联系方式
            <input
              className={inputClass}
              value={contactPrivate}
              onChange={(event) => setContactPrivate(event.target.value)}
              placeholder="微信、手机号或邮箱，仅向符合条件的用户展示"
              required
            />
          </label>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700"
            type="submit"
          >
            预览信息
          </button>
        </form>
      )}

      {step === 3 && type && (
        <div>
          <p className="text-sm font-medium text-indigo-600">
            {POST_TYPE_LABEL[type]} · {city}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            {title}
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                key={tag}
              >
                {tag}
              </span>
            ))}
          </div>
          <dl className="mt-8 space-y-4 rounded-2xl bg-slate-50 p-5 text-sm">
            {Object.entries(bodyForType())
              .filter(([, value]) => value && (!Array.isArray(value) || value.length))
              .map(([key, value]) => (
                <div key={key}>
                  <dt className="font-medium text-slate-500">
                    {BODY_LABELS[key] ?? key}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-slate-800">
                    {Array.isArray(value) ? value.join("、") : String(value)}
                  </dd>
                </div>
              ))}
          </dl>
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            联系方式将受到保护，不会出现在公开列表中。
          </p>
          {error && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="mt-8 flex gap-3">
            <button
              className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700"
              type="button"
              onClick={() => setStep(2)}
            >
              返回修改
            </button>
            <button
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              disabled={submitting}
              type="button"
              onClick={publish}
            >
              {submitting ? "发布中…" : "确认发布"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
