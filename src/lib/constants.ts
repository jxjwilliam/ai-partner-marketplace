export const CITIES = ["全部", "北京", "上海", "深圳", "杭州", "成都", "远程"] as const;
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

/** AI 请求（润色 / 推荐理由）最长等待时间 */
export const AI_REQUEST_TIMEOUT_MS = 10_000;
/** 首页 SSR 里 AI 推荐理由的最长等待时间（避免拖慢整页渲染） */
export const AI_HOMEPAGE_TIMEOUT_MS = 6_000;
