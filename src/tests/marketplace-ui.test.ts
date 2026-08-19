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
    expect(page).toContain("listPosts");
    expect(page).toContain("recommendForHome");
    expect(page).toContain("暂无帖子，来发布第一条");
    expect(page).toContain("<FilterBar");
    expect(page).toContain("<PostCard");
  });

  it("offers city, type, and multi-tag URL filters", () => {
    const filterBar = source("src/components/FilterBar.tsx");

    expect(filterBar).toContain("CITIES");
    expect(filterBar).toContain("POST_TYPE_LABEL");
    expect(filterBar).toContain("POST_FILTER_TYPES");
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
  it("renders structured content, publisher details, safety copy, and unlock panel", () => {
    const page = source("src/app/posts/[id]/page.tsx");
    const panel = source("src/components/ContactUnlockPanel.tsx");

    expect(page).toContain("getPostById");
    expect(page).toContain("getSessionUser");
    expect(page).toContain("incrementPostViews");
    expect(page).toContain("notFound()");
    expect(page).toContain("shouldRevealContact");
    expect(page).toContain("POST_TYPE_LABEL");
    expect(page).toContain("发布者");
    expect(page).toContain("平台仅提供信息撮合");
    expect(page).toContain("ContactUnlockPanel");
    expect(panel).toContain("/api/posts/");
    expect(panel).toContain("请先登录后申请");
    expect(panel).toContain("申请已提交，等待发布者处理");
    expect(panel).toContain("申请未通过");
    expect(panel).toContain("联系方式");
  });
});

describe("个人中心", () => {
  it("renders profile, posts, incoming decisions, and outgoing statuses", () => {
    const page = source("src/app/me/page.tsx");
    const dashboard = source("src/components/MeDashboard.tsx");
    const api = source("src/app/api/me/dashboard/route.ts");

    expect(page).toContain('router.replace("/login?next=/me")');
    expect(page).toContain("/api/me/dashboard");
    expect(page).toContain("getClientToken");
    expect(api).toContain("shouldRevealContact");
    expect(api).toContain("contact: reveal ? item.post!.contactPrivate : undefined");
    expect(dashboard).toContain("我的帖子");
    expect(dashboard).toContain("联系方式申请");
    expect(dashboard).toContain("/api/unlock/");
    expect(dashboard).toContain("/api/posts/");
    expect(dashboard).toContain("收到的申请");
    expect(dashboard).toContain("发出的申请");
  });
});
