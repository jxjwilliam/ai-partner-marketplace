import { afterEach, describe, expect, it, vi } from "vitest";
import { sendSmsOtp } from "@/lib/auth/sms";

const smsEnvKeys = [
  "SMS_DRY_RUN",
  "SMS_ACCESS_KEY_ID",
  "SMS_ACCESS_KEY_SECRET",
  "SMS_SIGN_NAME",
  "SMS_TEMPLATE_CODE",
] as const;

afterEach(() => {
  vi.restoreAllMocks();
  for (const key of smsEnvKeys) delete process.env[key];
});

describe("sendSmsOtp", () => {
  it("logs the code without contacting Aliyun in dry-run mode", async () => {
    process.env.SMS_DRY_RUN = "true";
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await sendSmsOtp("13800138000", "123456");

    expect(log).toHaveBeenCalledWith("[SMS_DRY_RUN] 13800138000 => 123456");
  });

  it("fails closed when Aliyun credentials are incomplete", async () => {
    process.env.SMS_DRY_RUN = "false";

    await expect(sendSmsOtp("13800138000", "123456")).rejects.toThrow(
      "SMS not configured",
    );
  });
});
