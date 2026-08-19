import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("社区动态区 UI", () => {
  it("community page renders composer, feed and pagination", () => {
    const page = source("src/app/community/page.tsx");
    expect(page).toContain("listCommunityPosts");
    expect(page).toContain("<CommunityComposer");
    expect(page).toContain("<CommunityPostCard");
    expect(page).toContain("加载更多");
    expect(page).toContain("资深技术人的交流区");
  });

  it("header exposes the community nav item", () => {
    const header = source("src/components/SiteHeader.tsx");
    expect(header).toContain('href="/community"');
    expect(header).toContain("MessageSquare");
    expect(header).toContain("社区");
  });

  it("comment list posts to /api/comments and reuses delete", () => {
    const list = source("src/components/CommentList.tsx");
    expect(list).toContain('apiFetch("/api/comments"');
    expect(list).toContain("targetType");
    expect(list).toContain("DeleteButton");
  });

  it("delete button issues a DELETE request", () => {
    const button = source("src/components/DeleteButton.tsx");
    expect(button).toContain('method: "DELETE"');
  });

  it("post detail page embeds listing comments", () => {
    const detail = source("src/app/posts/[id]/page.tsx");
    expect(detail).toContain("listCommentsForListingPost");
    expect(detail).toContain("<CommentList");
    expect(detail).toContain('targetType="listing"');
  });
});
