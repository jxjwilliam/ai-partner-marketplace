import { describe, expect, it } from "vitest";
import { parsePostInput } from "@/lib/posts/schemas";

describe("parsePostInput", () => {
  it("requires cooperationModes for partner", () => {
    const r = parsePostInput({
      type: "partner",
      title: "缺CTO",
      city: "北京",
      tags: ["Agent"],
      contactPrivate: "wx_abc",
      body: {
        projectStage: "有MVP",
        intro: "做企业客服Agent",
        techNeeds: "需要全栈",
        cooperationModes: [],
      },
    });
    expect(r.ok).toBe(false);
  });
  it("accepts valid partner", () => {
    const r = parsePostInput({
      type: "partner",
      title: "企业级AI客服Agent，已获种子轮，缺CTO",
      city: "北京",
      tags: ["Agent"],
      contactPrivate: "wx_abc",
      body: {
        projectStage: "已融资",
        intro: "做企业客服Agent，已有付费试点",
        techNeeds: "大模型应用 + 后端架构",
        cooperationModes: ["股权合伙"],
      },
    });
    expect(r.ok).toBe(true);
  });
});
