import { UNLOCK_MAX_PENDING_PER_DAY, UNLOCK_MIN_MESSAGE_LEN } from "@/lib/constants";

export function canCreateUnlockRequest(input: {
  authorId: string;
  requesterId: string;
  message: string;
  pendingToday: number;
  existingStatus: "pending" | "approved" | "rejected" | null;
  postStatus: "active" | "hidden";
}): { ok: true } | { ok: false; error: string } {
  if (input.postStatus !== "active") return { ok: false, error: "帖子不可用" };
  if (input.authorId === input.requesterId) {
    return { ok: false, error: "不能申请自己的帖子" };
  }
  if (input.message.trim().length < UNLOCK_MIN_MESSAGE_LEN) {
    return { ok: false, error: "请简单介绍一下你自己" };
  }
  if (input.existingStatus === "pending") {
    return { ok: false, error: "已有待处理申请" };
  }
  if (input.existingStatus === "approved") {
    return { ok: false, error: "已通过，可直接查看" };
  }
  if (input.pendingToday >= UNLOCK_MAX_PENDING_PER_DAY) {
    return { ok: false, error: "今日申请次数已达上限" };
  }
  return { ok: true };
}

export function nextUnlockStatus(
  current: "pending" | "approved" | "rejected",
  action: "approve" | "reject",
): "approved" | "rejected" {
  if (current !== "pending") throw new Error("invalid transition");
  return action === "approve" ? "approved" : "rejected";
}
