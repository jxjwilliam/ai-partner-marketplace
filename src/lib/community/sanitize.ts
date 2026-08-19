import { scrubContactText } from "@/lib/ai/polish";
import {
  COMMUNITY_COMMENT_MAX_LEN,
  COMMUNITY_POST_MAX_LEN,
} from "@/lib/constants";

/**
 * 社区文本写入前统一处理：去首尾空白、脱敏联系方式、限制长度。
 * 返回 null 表示内容为空/超长（由调用方给出中文错误）。
 */
export function sanitizeCommunityText(
  raw: unknown,
  options?: { maxLen?: number },
): string | null {
  if (typeof raw !== "string") return null;
  const maxLen = options?.maxLen ?? COMMUNITY_POST_MAX_LEN;
  const value = scrubContactText(raw.trim()).trim();
  if (!value) return null;
  if (value.length > maxLen) return null;
  return value;
}

export function sanitizeCommunityPost(raw: unknown): string | null {
  return sanitizeCommunityText(raw, { maxLen: COMMUNITY_POST_MAX_LEN });
}

export function sanitizeComment(raw: unknown): string | null {
  return sanitizeCommunityText(raw, { maxLen: COMMUNITY_COMMENT_MAX_LEN });
}
