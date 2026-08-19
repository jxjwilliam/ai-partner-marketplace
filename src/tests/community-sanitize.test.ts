import { describe, expect, it } from "vitest";
import {
  sanitizeComment,
  sanitizeCommunityPost,
} from "@/lib/community/sanitize";

describe("社区文本脱敏", () => {
  it("trims and keeps normal content", () => {
    expect(sanitizeCommunityPost("  分享经验  ")).toBe("分享经验");
    expect(sanitizeComment(" 同意  ")).toBe("同意");
  });

  it("rejects empty content", () => {
    expect(sanitizeCommunityPost("   ")).toBeNull();
    expect(sanitizeComment("")).toBeNull();
    expect(sanitizeCommunityPost(123)).toBeNull();
  });

  it("rejects content over the length limit", () => {
    expect(sanitizeCommunityPost("a".repeat(1001))).toBeNull();
    expect(sanitizeCommunityPost("a".repeat(1000))).toHaveLength(1000);
    expect(sanitizeComment("a".repeat(501))).toBeNull();
    expect(sanitizeComment("a".repeat(500))).toHaveLength(500);
  });

  it("masks phone, email and wechat ids so comments cannot leak contacts", () => {
    const value = sanitizeCommunityPost(
      "联系我 13800138000 或 name@example.com 或 微信 wxid_abc12345",
    );
    expect(value).toContain("[已隐藏]");
    expect(value).not.toContain("13800138000");
    expect(value).not.toContain("name@example.com");
    expect(value).not.toContain("wxid_abc12345");
  });
});
