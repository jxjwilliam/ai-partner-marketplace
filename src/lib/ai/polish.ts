const BLOCKED = /contact|phone|微信|手机|邮箱|email/i;

export function sanitizePolishFields(
  fields: Record<string, string>,
): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (BLOCKED.test(key) || BLOCKED.test(value)) continue;
    safe[key] = value;
  }
  return safe;
}

export async function polishFields(
  type: string,
  fields: Record<string, string>,
): Promise<Record<string, string>> {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL;
  if (!apiKey || !baseUrl) throw new Error("LLM not configured");

  const safeFields = sanitizePolishFields(fields);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "qwen-plus",
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
