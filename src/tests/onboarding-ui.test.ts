import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("登录与入驻界面", () => {
  it("renders the first login step in Chinese", () => {
    const page = source("src/app/login/page.tsx");

    expect(page).toContain("登录");
    expect(page).toContain("手机号");
    expect(page).toContain("获取验证码");
    expect(page).toContain("/api/auth/verify-otp");
  });

  it("renders every required onboarding choice", () => {
    const page = source("src/app/onboarding/page.tsx");

    expect(page).toContain("完善个人资料");
    expect(page).toContain("我是技术人");
    expect(page).toContain("我有项目");
    expect(page).toContain("我是投资人");
    expect(page).toContain("其他");
    expect(page).toContain('apiFetch("/api/me"');
  });
});

describe("全站页眉与页脚", () => {
  it("links visitors to login or their profile", () => {
    const header = source("src/components/SiteHeader.tsx");

    expect(header).toContain("AI合伙人集市");
    expect(header).toContain('href="/posts/new"');
    expect(header).toContain('user ? "/me" : "/login"');
  });

  it("wires the shared chrome into the root layout", () => {
    const layout = source("src/app/layout.tsx");

    expect(layout).toContain("<SiteHeader />");
    expect(layout).toContain("<SiteFooter />");
    expect(layout).toContain('lang="zh-CN"');
  });

  it("renders the marketplace disclaimer and report address", () => {
    const footer = source("src/components/SiteFooter.tsx");

    expect(footer).toContain("平台仅提供信息撮合");
    expect(footer).toContain("线下合作请自行签约");
    expect(footer).toContain("REPORT_EMAIL");
  });
});
