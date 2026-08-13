import { describe, expect, it } from "vitest";
import {
  buildPostWhere,
  buildSearchClause,
  isPostSort,
} from "@/lib/posts/filters";

describe("buildPostWhere", () => {
  it("returns an empty filter when nothing is selected", () => {
    expect(buildPostWhere({})).toEqual({});
  });
  it("filters city when not 全部", () => {
    expect(buildPostWhere({ city: "北京" })).toEqual({ city: "北京" });
    expect(buildPostWhere({ city: "全部" }).city).toBeUndefined();
  });
  it("keeps tags", () => {
    expect(buildPostWhere({ tags: ["Agent", "SaaS"] })).toEqual({
      tags: ["Agent", "SaaS"],
    });
  });
  it("ignores unknown type filters", () => {
    expect(buildPostWhere({ type: "invalid" }).type).toBeUndefined();
  });
  it("trims the search keyword", () => {
    expect(buildPostWhere({ search: " 出海 " })).toEqual({ search: "出海" });
  });
});

describe("buildSearchClause", () => {
  it("builds a PostgREST or() clause over title and body fields", () => {
    const clause = buildSearchClause("出海");
    expect(clause).toContain("title.ilike.*出海*");
    expect(clause).toContain("body_json->>intro.ilike.*出海*");
    expect(clause).toContain("body_json->>background.ilike.*出海*");
  });
  it("sanitizes wildcard and quote characters", () => {
    const clause = buildSearchClause("a*b'c");
    expect(clause).toContain("a*b'c".replace(/[*,%()'"\\]/g, ""));
    expect(clause).not.toContain("'");
  });
  it("returns null for blank input", () => {
    expect(buildSearchClause("   ")).toBeNull();
  });
});

describe("排序", () => {
  it("validates sort values", () => {
    expect(isPostSort("hot")).toBe(true);
    expect(isPostSort("latest")).toBe(true);
    expect(isPostSort("random")).toBe(false);
  });
});
