import { REPORT_EMAIL } from "@/lib/constants";

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-8 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>平台仅提供信息撮合，线下合作请自行签约并注意风险。</p>
        <p>
          举报邮箱：
          <a
            className="text-slate-700 underline-offset-4 hover:underline"
            href={`mailto:${REPORT_EMAIL}`}
          >
            {REPORT_EMAIL}
          </a>
        </p>
      </div>
    </footer>
  );
}
