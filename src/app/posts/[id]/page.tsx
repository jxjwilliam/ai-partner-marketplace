import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { POST_TYPE_LABEL } from "@/lib/constants";
import { prisma } from "@/lib/db";

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
  portfolio: "作品集或个人主页",
  projectKind: "项目类型",
  workMode: "合作模式",
  budget: "预算",
  duration: "预计周期",
  stage: "融资阶段",
  amount: "融资金额",
  team: "团队介绍",
  equity: "出让股权",
};

const ROLE_LABELS: Record<string, string> = {
  talent: "技术人才",
  founder: "项目方",
  investor: "投资人",
  other: "其他",
};

function displayValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(String).join("、");
  return "";
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getSessionUser();
  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      type: true,
      title: true,
      city: true,
      tags: true,
      bodyJson: true,
      status: true,
      createdAt: true,
      author: {
        select: { nickname: true, city: true, roleTag: true, createdAt: true },
      },
    },
  });

  if (
    !post ||
    (post.status === "hidden" &&
      viewer?.id !== post.authorId &&
      !viewer?.isAdmin)
  ) {
    notFound();
  }

  const updated = await prisma.post.update({
    where: { id: post.id },
    data: { viewCount: { increment: 1 } },
    select: { viewCount: true },
  });
  const viewCount = updated.viewCount;

  const body =
    post.bodyJson &&
    typeof post.bodyJson === "object" &&
    !Array.isArray(post.bodyJson)
      ? (post.bodyJson as Record<string, unknown>)
      : {};
  const fields = Object.entries(body)
    .map(([key, value]) => [key, displayValue(value)] as const)
    .filter(([, value]) => value);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <Link className="text-sm text-slate-500 hover:text-indigo-600" href="/">
        ← 返回集市
      </Link>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article className="border border-slate-200 bg-white">
          <header className="border-b border-slate-200 px-5 py-5 sm:px-7">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded bg-indigo-50 px-2 py-1 font-semibold text-indigo-700">
                {POST_TYPE_LABEL[post.type]}
              </span>
              <span className="text-slate-500">{post.city}</span>
              <span className="ml-auto text-xs text-slate-400">
                {post.createdAt.toLocaleDateString("zh-CN")} · {viewCount} 次浏览
              </span>
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              {post.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
          </header>

          <dl className="divide-y divide-slate-100 px-5 sm:px-7">
            {fields.map(([key, value]) => (
              <div className="grid gap-1 py-5 sm:grid-cols-[120px_1fr]" key={key}>
                <dt className="text-sm font-medium text-slate-500">
                  {BODY_LABELS[key] ?? key}
                </dt>
                <dd className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </article>

        <aside className="space-y-4">
          <section className="border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-950">发布者</h2>
            <p className="mt-3 font-medium text-slate-800">
              {post.author.nickname ?? "集市用户"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {[post.author.roleTag && ROLE_LABELS[post.author.roleTag], post.author.city]
                .filter(Boolean)
                .join(" · ") || "资料待完善"}
            </p>
            <p className="mt-3 text-xs text-slate-400">
              {post.author.createdAt.toLocaleDateString("zh-CN")} 加入
            </p>
          </section>

          {/* Task 10: replace this slot with ContactUnlockPanel. */}
          <section
            className="border border-dashed border-indigo-200 bg-indigo-50 p-5"
            data-contact-unlock-slot
          >
            <h2 className="font-semibold text-indigo-950">联系发布者</h2>
            <p className="mt-2 text-sm leading-6 text-indigo-700">
              联系方式受保护，解锁联系功能即将接入。
            </p>
          </section>

          <p className="border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
            平台仅提供信息撮合，不对合作结果作担保。沟通时请注意保护个人信息，涉及资金与股权请自行核验并签订正式协议。
          </p>
        </aside>
      </div>
    </main>
  );
}
