import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("发布信息界面", () => {
  it("redirects anonymous visitors to login and renders the form for users", () => {
    const page = source("src/app/posts/new/page.tsx");

    expect(page).toContain('redirect("/login?next=/posts/new")');
    expect(page).toContain("<PostForm");
    expect(page).toContain("getSessionUser");
  });

  it("implements the Chinese three-step publish flow", () => {
    const form = source("src/components/PostForm.tsx");

    expect(form).toContain("选择发布类型");
    expect(form).toContain("填写信息");
    expect(form).toContain("预览并发布");
    expect(form).toContain("POST_TYPE_LABEL");
    expect(form).toContain("FILTER_CITIES");
    expect(form).toContain("TAGS");
    expect(form).toContain('fetch("/api/posts"');
    expect(form).toContain('window.location.assign(`/posts/${result.id}`)');
  });

  it("wires AI polish into the form with adopt and discard actions", () => {
    const form = source("src/components/PostForm.tsx");
    const polish = source("src/components/AiPolishBlock.tsx");

    expect(form).toContain('import AiPolishBlock from "@/components/AiPolishBlock"');
    expect(form).toContain("<AiPolishBlock");
    expect(form).toContain("onAdopt=");
    expect(polish).toContain('fetch("/api/ai/polish"');
    expect(polish).toContain("一键润色");
    expect(polish).toContain("采用");
    expect(polish).toContain("放弃");
  });
});
