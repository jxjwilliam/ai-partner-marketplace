export async function sendSmsOtp(phone: string, code: string): Promise<void> {
  if (process.env.SMS_DRY_RUN === "true") {
    console.info(`[SMS_DRY_RUN] ${phone} => ${code}`);
    return;
  }

  const {
    SMS_ACCESS_KEY_ID,
    SMS_ACCESS_KEY_SECRET,
    SMS_SIGN_NAME,
    SMS_TEMPLATE_CODE,
  } = process.env;
  if (
    !SMS_ACCESS_KEY_ID ||
    !SMS_ACCESS_KEY_SECRET ||
    !SMS_SIGN_NAME ||
    !SMS_TEMPLATE_CODE
  ) {
    throw new Error("SMS not configured");
  }

  const Dysmsapi = await import("@alicloud/dysmsapi20170525");
  const OpenApi = await import("@alicloud/openapi-client");
  const Util = await import("@alicloud/tea-util");
  const config = new OpenApi.Config({
    accessKeyId: SMS_ACCESS_KEY_ID,
    accessKeySecret: SMS_ACCESS_KEY_SECRET,
  });
  config.endpoint = "dysmsapi.aliyuncs.com";

  const client = new Dysmsapi.default(config);
  const request = new Dysmsapi.SendSmsRequest({
    phoneNumbers: phone,
    signName: SMS_SIGN_NAME,
    templateCode: SMS_TEMPLATE_CODE,
    templateParam: JSON.stringify({ code }),
  });
  const response = await client.sendSmsWithOptions(
    request,
    new Util.RuntimeOptions({}),
  );

  if (response.body?.code !== "OK") {
    throw new Error(response.body?.message || "SMS send failed");
  }
}
