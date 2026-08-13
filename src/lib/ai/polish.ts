const BLOCKED = /contact|phone|微信|手机|邮箱|email/i;
const REDACTED = "[已隐藏]";

const PHONE_PATTERN = /1[3-9]\d{9}/g;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const WECHAT_PATTERN =
  /(?:wxid_[a-zA-Z0-9_-]+|(?:微信|wechat|wx)[：:\s]*[a-zA-Z][a-zA-Z0-9_-]{4,19})/gi;

function isEntireContactValue(value: string): boolean {
  const trimmed = value.trim();
  if (/^1[3-9]\d{9}$/.test(trimmed)) return true;
  if (/^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/.test(trimmed)) return true;
  if (/^wxid_[a-zA-Z0-9_-]+$/i.test(trimmed)) return true;
  if (/^(?:微信|wechat|wx)[：:\s]*[a-zA-Z][a-zA-Z0-9_-]{4,19}$/i.test(trimmed)) {
    return true;
  }
  return false;
}

function scrubContactPatterns(value: string): string {
  return value
    .replace(PHONE_PATTERN, REDACTED)
    .replace(EMAIL_PATTERN, REDACTED)
    .replace(WECHAT_PATTERN, REDACTED);
}

export function sanitizePolishFields(
  fields: Record<string, string>,
): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (BLOCKED.test(key)) continue;
    if (isEntireContactValue(value)) continue;

    const scrubbed = scrubContactPatterns(value);
    if (scrubbed.trim()) safe[key] = scrubbed;
  }
  return safe;
}

export async function polishFields(
  type: string,
  fields: Record<string, string>,
): Promise<Record<string, string>> {
  const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY;
  const baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL;
  if (!apiKey || !baseUrl) throw new Error("LLM not configured");

  const safeFields = sanitizePolishFields(fields);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_COMPATIBLE_MODEL || "qwen-plus",
      messages: [
        {
          role: "system",
          content:
            "你是中文文案润色助手。把用户提供的创业/技术合伙帖子字段改得更专业简洁。只返回JSON对象，键与输入相同，不要添加联系方式。",
        },
        {
          role: "user",
          content: JSON.stringify({ type, fields: safeFields }),
        },
      ],
      temperature: 0.4,
    }),
  });

  if (!response.ok) throw new Error("LLM failed");

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  const parsed: unknown = JSON.parse(
    text.replace(/^```json\s*|\s*```$/gi, "").trim(),
  );
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid LLM response");
  }

  const fieldsOut: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") fieldsOut[key] = value;
  }
  return sanitizePolishFields(fieldsOut);
}
