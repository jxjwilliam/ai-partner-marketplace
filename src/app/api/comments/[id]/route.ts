import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { deleteComment } from "@/lib/data";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "请先登录" },
      { status: 401 },
    );
  }
  const { id } = await params;
  const deleted = await deleteComment(id, user.id);
  if (!deleted) {
    return NextResponse.json(
      { ok: false, error: "评论不存在或无权删除" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
