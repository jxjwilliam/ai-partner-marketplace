import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { findOrCreateAuthUser } from "@/lib/data";

/**
 * Supabase 登录回调（邮箱魔法链接 / Google OAuth 共用）：
 * 客户端拿到 Supabase 会话后，把 access token 交给服务端，服务端用
 * service_role 校验（不信任客户端自述），再签发应用自己的 session token
 * （iframe 安全，与手机号登录共用同一套会话）。
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求格式错误" },
      { status: 400 },
    );
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "请求格式错误" },
      { status: 400 },
    );
  }

  const accessToken = String(
    (body as { accessToken?: unknown }).accessToken ?? "",
  ).trim();
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: "登录已失效，请重新获取登录链接" },
      { status: 401 },
    );
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      return NextResponse.json(
        { ok: false, error: "登录已失效，请重新获取登录链接" },
        { status: 401 },
      );
    }

    const authUser = data.user;
    const email = authUser.email?.trim().toLowerCase();
    // 魔法链接登录的用户应已完成邮箱确认；未确认视为无效登录
    if (!email || !authUser.email_confirmed_at) {
      return NextResponse.json(
        { ok: false, error: "邮箱尚未验证，请重新获取登录链接" },
        { status: 401 },
      );
    }

    const user = await findOrCreateAuthUser({
      authUserId: authUser.id,
      email,
    });
    const { token } = await createSession(user.id);
    await setSessionCookie(token);

    const needsOnboarding = !user.nickname || !user.city || !user.roleTag;
    return NextResponse.json({ ok: true, token, needsOnboarding });
  } catch {
    return NextResponse.json(
      { ok: false, error: "服务暂不可用，请稍后重试" },
      { status: 503 },
    );
  }
}
