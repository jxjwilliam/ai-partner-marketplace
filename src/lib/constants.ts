export const CITIES = [
  "全部",
  "北京",
  "上海",
  "深圳",
  "广州",
  "杭州",
  "成都",
  "西安",
  "远程",
] as const;
export const FILTER_CITIES = CITIES.filter((c) => c !== "全部");

export const POST_TYPE_LABEL: Record<string, string> = {
  partner: "找合伙人",
  talent: "我是人才",
  project: "接项目",
  funding: "找资金",
};

export const TAGS = [
  "AI大模型",
  "SaaS",
  "出海",
  "Agent",
  "全栈",
  "架构师",
  "35+优先",
  "股权合伙",
] as const;

export const HOME_PAGE_SIZE = 20;

export const SESSION_COOKIE = "aim_session";
export const SESSION_DAYS = 30;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_SENDS_PER_PHONE_DAY = 10;
export const OTP_MAX_SENDS_PER_IP_DAY = 20;
export const UNLOCK_MAX_PENDING_PER_DAY = 5;
export const UNLOCK_MIN_MESSAGE_LEN = 10;
export const REPORT_EMAIL = "report@example.com"; // replace before launch

/** 社区动态区（2026-08-18 修订） */
export const COMMUNITY_POST_MAX_LEN = 1000;
export const COMMUNITY_COMMENT_MAX_LEN = 500;
export const COMMUNITY_MAX_POSTS_PER_DAY = 20;
export const COMMUNITY_MAX_COMMENTS_PER_DAY = 50;
export const COMMUNITY_PAGE_SIZE = 20;

/** AI 请求（润色 / 推荐理由）最长等待时间 */
export const AI_REQUEST_TIMEOUT_MS = 10_000;
