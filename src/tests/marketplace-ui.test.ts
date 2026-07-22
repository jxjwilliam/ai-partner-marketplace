import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("集市首页", () => {
  it("queries active posts from URL filters and renders the empty state", () => {
    const page = source("src/app/page.tsx");

    expect(page).toContain("buildPostWhere");
    expect(page).toContain("searchParams");
    expect(page).toContain('split(",")');
    expect(page).toContain("prisma.post.findMany");
    expect(page).toContain("暂无帖子，来发布第一条");
    expect(page).toContain("<FilterBar");
    expect(page).toContain("<PostCard");
  });

  it("offers city, type, and multi-tag URL filters", () => {
    const filterBar = source("src/components/FilterBar.tsx");

    expect(filterBar).toContain("CITIES");
    expect(filterBar).toContain("POST_TYPE_LABEL");
    expect(filterBar).toContain("TAGS");
    expect(filterBar).toContain("URLSearchParams");
    expect(filterBar).toContain('params.set("tags"');
  });

  it("renders dense linked cards with type, snippet, and metadata", () => {
    const card = source("src/components/PostCard.tsx");

    expect(card).toContain("POST_TYPE_LABEL");
    expect(card).toContain("body.intro");
    expect(card).toContain("body.background");
    expect(card).toContain("viewCount");
    expect(card).toContain('href={`/posts/${post.id}`}');
  });
});

describe("帖子详情页", () => {
  it("renders structured content, publisher details, safety copy, and unlock slot", () => {
    const page = source("src/app/posts/[id]/page.tsx");

    expect(page).toContain("prisma.post.findFirst");
    expect(page).toContain("notFound()");
    expect(page).toContain("POST_TYPE_LABEL");
    expect(page).toContain("发布者");
    expect(page).toContain("平台仅提供信息撮合");
    expect(page).toContain("ContactUnlockPanel");
  });
});
