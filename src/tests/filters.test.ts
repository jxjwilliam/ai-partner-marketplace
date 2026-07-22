import { describe, expect, it } from "vitest";
import { buildPostWhere } from "@/lib/posts/filters";

describe("buildPostWhere", () => {
  it("always restricts to active", () => {
    expect(buildPostWhere({})).toMatchObject({ status: "active" });
  });
  it("filters city when not 全部", () => {
    expect(buildPostWhere({ city: "北京" })).toMatchObject({ city: "北京" });
    expect(buildPostWhere({ city: "全部" }).city).toBeUndefined();
  });
  it("AND tags", () => {
    const w = buildPostWhere({ tags: ["Agent", "SaaS"] });
    expect(w.AND).toEqual([{ tags: { has: "Agent" } }, { tags: { has: "SaaS" } }]);
  });
});
