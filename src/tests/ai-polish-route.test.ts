import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  polishFields: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/lib/ai/polish", () => ({
  polishFields: mocks.polishFields,
}));

import { POST } from "@/app/api/ai/polish/route";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/ai/polish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessionUser.mockResolvedValue({ id: "user-1" });
  mocks.polishFields.mockResolvedValue({ intro: "专业简洁的项目介绍" });
});

describe("POST /api/ai/polish", () => {
  it("requires authentication", async () => {
    mocks.getSessionUser.mockResolvedValue(null);

    const response = await POST(
      request({ type: "partner", fields: { intro: "项目介绍" } }),
    );

    expect(response.status).toBe(401);
    expect(mocks.polishFields).not.toHaveBeenCalled();
  });

  it("returns polished fields for an authenticated user", async () => {
    const response = await POST(
      request({ type: "partner", fields: { intro: "项目介绍" } }),
    );

    expect(mocks.polishFields).toHaveBeenCalledWith("partner", {
      intro: "项目介绍",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      fields: { intro: "专业简洁的项目介绍" },
    });
  });

  it("returns a stable 503 response when the LLM fails", async () => {
    mocks.polishFields.mockRejectedValue(new Error("provider unavailable"));

    const response = await POST(
      request({ type: "partner", fields: { intro: "项目介绍" } }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "润色暂不可用",
    });
  });
});
