export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <p className="rounded-full bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700">
        找到能一起把事情做成的人
      </p>
      <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
        AI合伙人集市
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
        连接技术人才、创业项目与投资人，让靠谱的能力与机会彼此看见。
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a
          className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700"
          href="/posts/new"
        >
          发布合作信息
        </a>
        <a
          className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:border-slate-400"
          href="/login"
        >
          登录集市
        </a>
      </div>
    </main>
  );
}
