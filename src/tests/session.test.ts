import { describe, expect, it } from "vitest";
import { hashToken } from "@/lib/auth/session-token";

describe("hashToken", () => {
  it("is stable", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});
