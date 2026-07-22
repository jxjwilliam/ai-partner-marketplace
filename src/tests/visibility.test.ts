import { describe, expect, it } from "vitest";
import { shouldRevealContact } from "@/lib/posts/visibility";

describe("shouldRevealContact", () => {
  it("author always", () => {
    expect(
      shouldRevealContact({ viewerId: "a", authorId: "a", unlockStatus: null }),
    ).toBe(true);
  });
  it("approved requester", () => {
    expect(
      shouldRevealContact({
        viewerId: "b",
        authorId: "a",
        unlockStatus: "approved",
      }),
    ).toBe(true);
  });
  it("others false", () => {
    expect(
      shouldRevealContact({
        viewerId: "b",
        authorId: "a",
        unlockStatus: "pending",
      }),
    ).toBe(false);
  });
});
