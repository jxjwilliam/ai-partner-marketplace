import { afterEach, describe, expect, it, vi } from "vitest";
import { polishFields, sanitizePolishFields } from "@/lib/ai/polish";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sanitizePolishFields", () => {
  it("removes fields whose key identifies contact information", () => {
    expect(
      sanitizePolishFields({
        intro: "已完成 MVP",
        contactPrivate: "founder",
        phone: "13800138000",
        微信: "founder-wx",
        手机号码: "13800138000",
        emailAddress: "founder@example.com",
      }),
    ).toEqual({ intro: "已完成 MVP" });
  });

  it("removes fields whose value contains contact information", () => {
    expect(
      sanitizePolishFields({
        intro: "联系微信 founder-wx",
        team: "邮箱 founder@example.com",
        needs: "寻找全栈开发伙伴",
      }),
    ).toEqual({ needs: "寻找全栈开发伙伴" });
  });

  it("keeps safe copy fields unchanged", () => {
    const fields = {
      title: "寻找技术合伙人",
      intro: "产品已进入内测阶段",
    };

    expect(sanitizePolishFields(fields)).toEqual(fields);
  });
});

describe("polishFields", () => {
  it("never includes contact fields in the LLM request", async () => {
    vi.stubEnv("LLM_API_KEY", "test-key");
    vi.stubEnv("LLM_BASE_URL", "https://llm.example.com");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"intro":"润色后的介绍"}' } }],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await polishFields("partner", {
      intro: "原始介绍",
      phone: "13800138000",
      note: "微信 founder-wx",
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMessage = JSON.parse(requestBody.messages[1].content);
    expect(userMessage.fields).toEqual({ intro: "原始介绍" });
  });
});
