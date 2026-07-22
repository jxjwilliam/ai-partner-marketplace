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

  it("drops fields whose value is entirely a phone number", () => {
    expect(
      sanitizePolishFields({
        intro: "已完成 MVP",
        backup: "13800138000",
      }),
    ).toEqual({ intro: "已完成 MVP" });
  });

  it("drops fields whose value is entirely an email address", () => {
    expect(
      sanitizePolishFields({
        intro: "已完成 MVP",
        backup: "founder@example.com",
      }),
    ).toEqual({ intro: "已完成 MVP" });
  });

  it("redacts phone numbers embedded in longer strings", () => {
    expect(
      sanitizePolishFields({
        intro: "如需沟通请拨打13800138000了解详情",
      }),
    ).toEqual({ intro: "如需沟通请拨打[已隐藏]了解详情" });
  });

  it("redacts email addresses embedded in longer strings", () => {
    expect(
      sanitizePolishFields({
        team: "请发简历至founder@example.com，我们会尽快回复",
      }),
    ).toEqual({ team: "请发简历至[已隐藏]，我们会尽快回复" });
  });

  it("redacts wechat handles embedded in longer strings", () => {
    expect(
      sanitizePolishFields({
        intro: "联系微信 founder-wx",
        team: "邮箱 founder@example.com",
        needs: "寻找全栈开发伙伴",
      }),
    ).toEqual({
      intro: "联系[已隐藏]",
      team: "邮箱 [已隐藏]",
      needs: "寻找全栈开发伙伴",
    });
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
