import { describe, expect, it } from "vitest";
import { canCreateUnlockRequest, nextUnlockStatus } from "@/lib/unlock/state";

describe("canCreateUnlockRequest", () => {
  it("blocks own post", () => {
    expect(
      canCreateUnlockRequest({
        authorId: "u1",
        requesterId: "u1",
        message: "你好我是前阿里P8想聊聊",
        pendingToday: 0,
        existingStatus: null,
        postStatus: "active",
      }).ok,
    ).toBe(false);
  });
  it("blocks short message", () => {
    expect(
      canCreateUnlockRequest({
        authorId: "a",
        requesterId: "b",
        message: "hi",
        pendingToday: 0,
        existingStatus: null,
        postStatus: "active",
      }).ok,
    ).toBe(false);
  });
  it("blocks second pending", () => {
    expect(
      canCreateUnlockRequest({
        authorId: "a",
        requesterId: "b",
        message: "你好我是前阿里P8想聊聊",
        pendingToday: 0,
        existingStatus: "pending",
        postStatus: "active",
      }).ok,
    ).toBe(false);
  });
});

describe("nextUnlockStatus", () => {
  it("approve/reject from pending", () => {
    expect(nextUnlockStatus("pending", "approve")).toBe("approved");
    expect(nextUnlockStatus("pending", "reject")).toBe("rejected");
  });
});
