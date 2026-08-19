# AI合伙人集市 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **状态：历史计划文档（2026-07-21）。** 实际实现已偏离本文部分条目：数据库为
> Supabase 托管 PostgreSQL + supabase-js（非 Prisma）；登录已新增邮箱魔法链接与 Google OAuth；
> 评论/社区动态已按 2026-08-18 设计修订（见
> `docs/superpowers/specs/2026-07-21-ai-partner-marketplace-design.md` 文末修订节）纳入 v1.1。
> 后续以设计文档最新修订与代码为准。

**Goal:** Build a China-mainland Craigslist-style web board (phone OTP, four post types, filters, contact unlock, AI polish) on Next.js + Aliyun RDS.

**Architecture:** Next.js 15 App Router monolith on 阿里云 ECS/轻量; Server Actions/Route Handlers talk to PostgreSQL (Prisma); 阿里云短信 for OTP; mainland LLM for draft polish only; httpOnly session cookies.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Prisma + PostgreSQL, Vitest, 阿里云短信 SDK (or HTTP API), OpenAI-compatible LLM client for 通义/百炼.

## Global Constraints

- Chinese UI copy only for user-facing strings
- Phone OTP auth only (no WeChat / email login in v1)
- Contact always gated until author approves unlock
- Never send phone or `contact_private` into LLM prompts
- Public reads only `posts.status = active`
- OTP limits: 60s send cooldown; 5 verify attempts/code; 10 sends/phone/day; 20 sends/IP/day
- Unlock limits: 5 pending requests/requester/day; one open pending per (requester, post)
- No comments, DMs, search engine, payment, or mini-program in v1
- Spec override: `docs/superpowers/specs/2026-07-21-ai-partner-marketplace-design.md`

---

## File map (create as tasks land)

```
package.json
vitest.config.ts
.env.example
prisma/schema.prisma
prisma/seed.ts
src/lib/db.ts
src/lib/auth/otp.ts
src/lib/auth/session.ts
src/lib/auth/sms.ts
src/lib/posts/schemas.ts
src/lib/posts/filters.ts
src/lib/posts/visibility.ts
src/lib/unlock/state.ts
src/lib/ai/polish.ts
src/lib/constants.ts
src/app/layout.tsx
src/app/globals.css
src/app/page.tsx
src/app/login/page.tsx
src/app/onboarding/page.tsx
src/app/posts/new/page.tsx
src/app/posts/[id]/page.tsx
src/app/me/page.tsx
src/app/api/auth/send-otp/route.ts
src/app/api/auth/verify-otp/route.ts
src/app/api/auth/logout/route.ts
src/app/api/me/route.ts
src/app/api/posts/route.ts
src/app/api/posts/[id]/route.ts
src/app/api/posts/[id]/unlock/route.ts
src/app/api/unlock/[requestId]/route.ts
src/app/api/ai/polish/route.ts
src/components/SiteHeader.tsx
src/components/SiteFooter.tsx
src/components/PostCard.tsx
src/components/FilterBar.tsx
src/components/PostForm.tsx
src/components/ContactUnlockPanel.tsx
src/components/AiPolishBlock.tsx
src/tests/otp.test.ts
src/tests/filters.test.ts
src/tests/unlock-state.test.ts
src/tests/visibility.test.ts
docs/deploy-aliyun.md
```

---

### Task 1: Scaffold app + Prisma schema

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`, `.env.example`, `prisma/schema.prisma`, `src/lib/db.ts`, `src/lib/constants.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` (placeholder)
- Test: none yet (schema validated via `prisma validate`)

**Interfaces:**
- Consumes: none
- Produces: Prisma client `src/lib/db.ts` exporting `prisma`; enums/constants in `src/lib/constants.ts`

- [ ] **Step 1: Scaffold Next.js in repo root**

```bash
cd /Users/william.jiang/my-tests/my-cv/old-professional-chuangye
npx create-next-app@15 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --yes
```

If create-next-app refuses non-empty dir, scaffold in `/tmp/aimarket` and move `src`, config files into the repo (keep existing `docs/`).

- [ ] **Step 2: Add deps**

```bash
npm install prisma @prisma/client zod bcryptjs nanoid
npm install -D vitest @types/bcryptjs tsx
npx prisma init
```

- [ ] **Step 3: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum RoleTag {
  talent
  founder
  investor
  other
}

enum PostType {
  partner
  talent
  project
  funding
}

enum PostStatus {
  active
  hidden
}

enum UnlockStatus {
  pending
  approved
  rejected
}

model User {
  id        String   @id @default(cuid())
  phone     String   @unique
  nickname  String?
  city      String?
  roleTag   RoleTag? @map("role_tag")
  bio       String?
  isAdmin   Boolean  @default(false) @map("is_admin")
  createdAt DateTime @default(now()) @map("created_at")
  posts     Post[]
  sessions  Session[]
  unlocks   ContactRequest[] @relation("Requester")
}

model OtpCode {
  id        String   @id @default(cuid())
  phone     String
  codeHash  String   @map("code_hash")
  expiresAt DateTime @map("expires_at")
  attempts  Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")
  ip        String?

  @@index([phone, createdAt])
}

model Session {
  id        String   @id @default(cuid())
  tokenHash String   @unique @map("token_hash")
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")
}

model Post {
  id             String     @id @default(cuid())
  authorId       String     @map("author_id")
  author         User       @relation(fields: [authorId], references: [id], onDelete: Cascade)
  type           PostType
  title          String
  city           String
  tags           String[]
  bodyJson       Json       @map("body_json")
  contactPrivate String     @map("contact_private")
  status         PostStatus @default(active)
  viewCount      Int        @default(0) @map("view_count")
  createdAt      DateTime   @default(now()) @map("created_at")
  bumpedAt       DateTime   @default(now()) @map("bumped_at")
  unlocks        ContactRequest[]

  @@index([status, bumpedAt])
  @@index([type, city])
}

model ContactRequest {
  id          String       @id @default(cuid())
  postId      String       @map("post_id")
  post        Post         @relation(fields: [postId], references: [id], onDelete: Cascade)
  requesterId String       @map("requester_id")
  requester   User         @relation("Requester", fields: [requesterId], references: [id], onDelete: Cascade)
  message     String
  status      UnlockStatus @default(pending)
  createdAt   DateTime     @default(now()) @map("created_at")
  decidedAt   DateTime?    @map("decided_at")

  @@unique([postId, requesterId])
  @@index([requesterId, status, createdAt])
}
```

- [ ] **Step 4: Write `src/lib/db.ts` and `src/lib/constants.ts`**

```ts
// src/lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

```ts
// src/lib/constants.ts
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
```

- [ ] **Step 5: Write `.env.example` and `vitest.config.ts`**

```env
DATABASE_URL=postgresql://USER:PASS@127.0.0.1:5432/ai_partner
SESSION_SECRET=change-me-to-long-random
SMS_ACCESS_KEY_ID=
SMS_ACCESS_KEY_SECRET=
SMS_SIGN_NAME=
SMS_TEMPLATE_CODE=
SMS_DRY_RUN=true
LLM_API_KEY=
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_MODEL=qwen-plus
ADMIN_PHONES=13800138000
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { environment: "node", include: ["src/tests/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 6: Validate schema**

```bash
npx prisma validate
```

Expected: schema is valid.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json prisma src/lib vitest.config.ts .env.example next.config.ts tsconfig.json postcss.config.mjs tailwind.config.ts src/app
git commit -m "chore: scaffold Next.js app and Prisma schema"
```

---

### Task 2: OTP helpers (unit tests first)

**Files:**
- Create: `src/lib/auth/otp.ts`, `src/tests/otp.test.ts`
- Modify: none

**Interfaces:**
- Consumes: constants from `@/lib/constants`
- Produces:
  - `normalizePhone(phone: string): string | null` — 11-digit CN mobile or null
  - `hashOtp(code: string): Promise<string>`
  - `verifyOtpHash(code: string, hash: string): Promise<boolean>`
  - `generateOtpCode(): string` — 6 digits
  - `assertCanSendOtp(input: { lastSentAt: Date | null; sendsPhoneToday: number; sendsIpToday: number; now?: Date }): { ok: true } | { ok: false; error: string }`
  - `assertCanVerifyOtp(input: { attempts: number; expiresAt: Date; now?: Date }): { ok: true } | { ok: false; error: string }`

- [ ] **Step 1: Write failing tests**

```ts
// src/tests/otp.test.ts
import { describe, expect, it } from "vitest";
import {
  normalizePhone,
  assertCanSendOtp,
  assertCanVerifyOtp,
  generateOtpCode,
} from "@/lib/auth/otp";

describe("normalizePhone", () => {
  it("accepts 11-digit CN mobile", () => {
    expect(normalizePhone("13812345678")).toBe("13812345678");
    expect(normalizePhone(" 138-1234-5678 ")).toBe("13812345678");
  });
  it("rejects invalid", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("12812345678")).toBeNull();
  });
});

describe("assertCanSendOtp", () => {
  const now = new Date("2026-07-21T12:00:00Z");
  it("blocks cooldown", () => {
    const r = assertCanSendOtp({
      lastSentAt: new Date("2026-07-21T11:59:30Z"),
      sendsPhoneToday: 0,
      sendsIpToday: 0,
      now,
    });
    expect(r).toEqual({ ok: false, error: "发送太频繁，请稍后再试" });
  });
  it("blocks phone daily cap", () => {
    const r = assertCanSendOtp({
      lastSentAt: null,
      sendsPhoneToday: 10,
      sendsIpToday: 0,
      now,
    });
    expect(r.ok).toBe(false);
  });
  it("allows when under limits", () => {
    const r = assertCanSendOtp({
      lastSentAt: new Date("2026-07-21T11:58:00Z"),
      sendsPhoneToday: 1,
      sendsIpToday: 1,
      now,
    });
    expect(r).toEqual({ ok: true });
  });
});

describe("assertCanVerifyOtp", () => {
  it("blocks expired", () => {
    const r = assertCanVerifyOtp({
      attempts: 0,
      expiresAt: new Date("2026-07-21T11:00:00Z"),
      now: new Date("2026-07-21T12:00:00Z"),
    });
    expect(r).toEqual({ ok: false, error: "验证码已过期" });
  });
  it("blocks too many attempts", () => {
    const r = assertCanVerifyOtp({
      attempts: 5,
      expiresAt: new Date("2026-07-21T13:00:00Z"),
      now: new Date("2026-07-21T12:00:00Z"),
    });
    expect(r).toEqual({ ok: false, error: "验证码错误次数过多" });
  });
});

describe("generateOtpCode", () => {
  it("returns 6 digits", () => {
    expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- src/tests/otp.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/auth/otp.ts`**

```ts
import bcrypt from "bcryptjs";
import {
  OTP_COOLDOWN_MS,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS_PER_IP_DAY,
  OTP_MAX_SENDS_PER_PHONE_DAY,
} from "@/lib/constants";

export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!/^1[3-9]\d{9}$/.test(digits)) return null;
  return digits;
}

export function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function verifyOtpHash(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export function assertCanSendOtp(input: {
  lastSentAt: Date | null;
  sendsPhoneToday: number;
  sendsIpToday: number;
  now?: Date;
}): { ok: true } | { ok: false; error: string } {
  const now = input.now ?? new Date();
  if (input.lastSentAt && now.getTime() - input.lastSentAt.getTime() < OTP_COOLDOWN_MS) {
    return { ok: false, error: "发送太频繁，请稍后再试" };
  }
  if (input.sendsPhoneToday >= OTP_MAX_SENDS_PER_PHONE_DAY) {
    return { ok: false, error: "今日发送次数已达上限" };
  }
  if (input.sendsIpToday >= OTP_MAX_SENDS_PER_IP_DAY) {
    return { ok: false, error: "今日发送次数已达上限" };
  }
  return { ok: true };
}

export function assertCanVerifyOtp(input: {
  attempts: number;
  expiresAt: Date;
  now?: Date;
}): { ok: true } | { ok: false; error: string } {
  const now = input.now ?? new Date();
  if (now > input.expiresAt) return { ok: false, error: "验证码已过期" };
  if (input.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "验证码错误次数过多" };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- src/tests/otp.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/otp.ts src/tests/otp.test.ts
git commit -m "feat: add OTP normalize and rate-limit helpers"
```

---

### Task 3: Session helpers

**Files:**
- Create: `src/lib/auth/session.ts`, `src/tests/session.test.ts` (optional light tests for hash roundtrip)

**Interfaces:**
- Consumes: `SESSION_COOKIE`, `SESSION_DAYS`, `prisma`
- Produces:
  - `createSessionToken(): string`
  - `hashToken(token: string): string` (sha256 hex)
  - `createSession(userId: string): Promise<{ token: string }>`
  - `getSessionUser(): Promise<User | null>` (reads cookie via `next/headers`)
  - `destroySession(): Promise<void>`
  - `setSessionCookie(token: string): Promise<void>`
  - `clearSessionCookie(): Promise<void>`

- [ ] **Step 1: Implement session module**

```ts
// src/lib/auth/session.ts
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/constants";

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string }> {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });
  return { token };
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  await clearSessionCookie();
}
```

- [ ] **Step 2: Unit-test hashToken determinism**

```ts
// src/tests/session.test.ts
import { describe, expect, it } from "vitest";
import { hashToken } from "@/lib/auth/session";

describe("hashToken", () => {
  it("is stable", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});
```

Note: `getSessionUser` uses `next/headers` — do not import it from Vitest without mocking; keep DB-backed session tests for Task 4 integration if needed. If `session.ts` import of `cookies` breaks Vitest, split pure helpers (`hashToken`, `createSessionToken`) into `src/lib/auth/session-token.ts` and import those in tests.

- [ ] **Step 3: Run**

```bash
npm test -- src/tests/session.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/session.ts src/lib/auth/session-token.ts src/tests/session.test.ts
git commit -m "feat: add session cookie helpers"
```

---

### Task 4: SMS adapter + auth API routes

**Files:**
- Create: `src/lib/auth/sms.ts`, `src/app/api/auth/send-otp/route.ts`, `src/app/api/auth/verify-otp/route.ts`, `src/app/api/auth/logout/route.ts`

**Interfaces:**
- Consumes: otp helpers, session helpers, prisma
- Produces: HTTP JSON APIs
  - `POST /api/auth/send-otp` `{ phone }` → `{ ok: true }` | `{ ok: false, error }`
  - `POST /api/auth/verify-otp` `{ phone, code }` → `{ ok: true, needsOnboarding: boolean }` + Set-Cookie
  - `POST /api/auth/logout` → `{ ok: true }`

- [ ] **Step 1: Implement SMS with dry-run**

```ts
// src/lib/auth/sms.ts
export async function sendSmsOtp(phone: string, code: string): Promise<void> {
  if (process.env.SMS_DRY_RUN === "true") {
    console.info(`[SMS_DRY_RUN] ${phone} => ${code}`);
    return;
  }
  // Use 阿里云 Dysmsapi — wire @alicloud/dysmsapi20170525 or REST.
  // Required env: SMS_ACCESS_KEY_ID, SMS_ACCESS_KEY_SECRET, SMS_SIGN_NAME, SMS_TEMPLATE_CODE
  // Template param: { code }
  const { SMS_ACCESS_KEY_ID, SMS_ACCESS_KEY_SECRET, SMS_SIGN_NAME, SMS_TEMPLATE_CODE } =
    process.env;
  if (!SMS_ACCESS_KEY_ID || !SMS_ACCESS_KEY_SECRET || !SMS_SIGN_NAME || !SMS_TEMPLATE_CODE) {
    throw new Error("SMS not configured");
  }
  // Implementation: call Aliyun SendSms; on non-OK throw Error so route fails closed.
  const Dysmsapi = await import("@alicloud/dysmsapi20170525");
  const OpenApi = await import("@alicloud/openapi-client");
  const Util = await import("@alicloud/tea-util");
  const config = new OpenApi.Config({
    accessKeyId: SMS_ACCESS_KEY_ID,
    accessKeySecret: SMS_ACCESS_KEY_SECRET,
  });
  config.endpoint = "dysmsapi.aliyuncs.com";
  const client = new Dysmsapi.default(config);
  const req = new Dysmsapi.SendSmsRequest({
    phoneNumbers: phone,
    signName: SMS_SIGN_NAME,
    templateCode: SMS_TEMPLATE_CODE,
    templateParam: JSON.stringify({ code }),
  });
  const resp = await client.sendSmsWithOptions(req, new Util.RuntimeOptions({}));
  if (resp.body?.code !== "OK") {
    throw new Error(resp.body?.message || "SMS send failed");
  }
}
```

Install: `npm install @alicloud/dysmsapi20170525 @alicloud/openapi-client @alicloud/tea-util`

- [ ] **Step 2: Implement send-otp route**

```ts
// src/app/api/auth/send-otp/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  assertCanSendOtp,
  generateOtpCode,
  hashOtp,
  normalizePhone,
} from "@/lib/auth/otp";
import { sendSmsOtp } from "@/lib/auth/sms";
import { OTP_TTL_MS } from "@/lib/constants";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const phone = normalizePhone(String(body.phone ?? ""));
  if (!phone) {
    return NextResponse.json({ ok: false, error: "手机号格式不正确" }, { status: 400 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [last, sendsPhoneToday, sendsIpToday] = await Promise.all([
    prisma.otpCode.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } }),
    prisma.otpCode.count({ where: { phone, createdAt: { gte: dayStart } } }),
    prisma.otpCode.count({ where: { ip, createdAt: { gte: dayStart } } }),
  ]);

  const gate = assertCanSendOtp({
    lastSentAt: last?.createdAt ?? null,
    sendsPhoneToday,
    sendsIpToday,
  });
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: 429 });
  }

  const code = generateOtpCode();
  try {
    await sendSmsOtp(phone, code);
  } catch {
    return NextResponse.json({ ok: false, error: "服务暂不可用" }, { status: 503 });
  }

  await prisma.otpCode.create({
    data: {
      phone,
      codeHash: await hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      ip,
    },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Implement verify-otp + logout**

```ts
// src/app/api/auth/verify-otp/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  assertCanVerifyOtp,
  normalizePhone,
  verifyOtpHash,
} from "@/lib/auth/otp";
import { createSession, setSessionCookie } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const phone = normalizePhone(String(body.phone ?? ""));
  const code = String(body.code ?? "");
  if (!phone || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "验证码错误" }, { status: 400 });
  }

  const otp = await prisma.otpCode.findFirst({
    where: { phone },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) {
    return NextResponse.json({ ok: false, error: "请先获取验证码" }, { status: 400 });
  }

  const gate = assertCanVerifyOtp({ attempts: otp.attempts, expiresAt: otp.expiresAt });
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: 400 });
  }

  const match = await verifyOtpHash(code, otp.codeHash);
  if (!match) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json({ ok: false, error: "验证码错误" }, { status: 400 });
  }

  await prisma.otpCode.deleteMany({ where: { phone } });

  const adminPhones = (process.env.ADMIN_PHONES || "").split(",").map((s) => s.trim());
  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({
      data: { phone, isAdmin: adminPhones.includes(phone) },
    });
  }

  const { token } = await createSession(user.id);
  await setSessionCookie(token);

  const needsOnboarding = !user.nickname || !user.city || !user.roleTag;
  return NextResponse.json({ ok: true, needsOnboarding });
}
```

```ts
// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Manual dry-run check**

With `SMS_DRY_RUN=true` and local Postgres migrated (`npx prisma migrate dev --name init`):

```bash
curl -s -X POST localhost:3000/api/auth/send-otp -H 'content-type: application/json' -d '{"phone":"13800138000"}'
# expect {"ok":true}; server log shows code
curl -s -X POST localhost:3000/api/auth/verify-otp -H 'content-type: application/json' -d '{"phone":"13800138000","code":"<from log>"}' -c /tmp/cj
# expect {"ok":true,"needsOnboarding":true}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/sms.ts src/app/api/auth
git commit -m "feat: add phone OTP send/verify API routes"
```

---

### Task 5: Login + onboarding UI

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/onboarding/page.tsx`, `src/app/api/me/route.ts`, `src/components/SiteHeader.tsx`, `src/components/SiteFooter.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx` (wire header)

**Interfaces:**
- Consumes: auth APIs
- Produces: `PATCH /api/me` `{ nickname, city, roleTag, bio? }`

- [ ] **Step 1: `PATCH /api/me`**

```ts
// src/app/api/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { FILTER_CITIES } from "@/lib/constants";
import { RoleTag } from "@prisma/client";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      city: user.city,
      roleTag: user.roleTag,
      bio: user.bio,
      isAdmin: user.isAdmin,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  const body = await req.json();
  const nickname = String(body.nickname ?? "").trim().slice(0, 32);
  const city = String(body.city ?? "");
  const roleTag = body.roleTag as RoleTag;
  const bio = body.bio != null ? String(body.bio).slice(0, 200) : undefined;
  if (!nickname || !FILTER_CITIES.includes(city as (typeof FILTER_CITIES)[number])) {
    return NextResponse.json({ ok: false, error: "请填写昵称和城市" }, { status: 400 });
  }
  if (!["talent", "founder", "investor", "other"].includes(roleTag)) {
    return NextResponse.json({ ok: false, error: "请选择身份" }, { status: 400 });
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { nickname, city, roleTag, bio },
  });
  return NextResponse.json({ ok: true, user: updated });
}
```

Fix GET: do not destructure nonexistent field — return `{ id, phone, nickname, city, roleTag, bio, isAdmin }`.

- [ ] **Step 2: Login page (client component)**

Two-step UI: phone → send OTP → code → verify → redirect `/onboarding` or `/`.

Copy: 标题「登录」、按钮「获取验证码」「登录」、错误文案用 API `error`.

- [ ] **Step 3: Onboarding page**

Fields: nickname, city select (`FILTER_CITIES`), roleTag radios (我是技术人 / 我有项目 / 我是投资人 / 其他), optional bio. Submit PATCH `/api/me` → `/`.

- [ ] **Step 4: Header/Footer**

`SiteHeader`: brand「AI合伙人集市」, links 浏览 `/`, 发布 `/posts/new`, 登录 or 我的 `/me`.  
`SiteFooter`: 平台仅信息撮合、线下自行签约; 举报 `REPORT_EMAIL`.

- [ ] **Step 5: Manual check** — login dry-run → onboarding → header shows nickname.

- [ ] **Step 6: Commit**

```bash
git add src/app/login src/app/onboarding src/app/api/me src/components/SiteHeader.tsx src/components/SiteFooter.tsx src/app/layout.tsx
git commit -m "feat: add login and onboarding pages"
```

---

### Task 6: Post schemas + list filters (unit TDD)

**Files:**
- Create: `src/lib/posts/schemas.ts`, `src/lib/posts/filters.ts`, `src/tests/filters.test.ts`, `src/tests/schemas.test.ts`

**Interfaces:**
- Produces:
  - `parsePostInput(raw: unknown): { ok: true; data: CreatePostInput } | { ok: false; error: string }`
  - `buildPostWhere(q: { city?: string; type?: string; tags?: string[] }): Prisma.PostWhereInput`

- [ ] **Step 1: Write failing filter/schema tests**

```ts
// src/tests/filters.test.ts
import { describe, expect, it } from "vitest";
import { buildPostWhere } from "@/lib/posts/filters";

describe("buildPostWhere", () => {
  it("always restricts to active", () => {
    expect(buildPostWhere({})).toMatchObject({ status: "active" });
  });
  it("filters city when not 全部", () => {
    expect(buildPostWhere({ city: "北京" })).toMatchObject({ city: "北京" });
    expect(buildPostWhere({ city: "全部" }).city).toBeUndefined();
  });
  it("AND tags", () => {
    const w = buildPostWhere({ tags: ["Agent", "SaaS"] });
    expect(w.AND).toEqual([{ tags: { has: "Agent" } }, { tags: { has: "SaaS" } }]);
  });
});
```

```ts
// src/tests/schemas.test.ts
import { describe, expect, it } from "vitest";
import { parsePostInput } from "@/lib/posts/schemas";

describe("parsePostInput", () => {
  it("requires cooperationModes for partner", () => {
    const r = parsePostInput({
      type: "partner",
      title: "缺CTO",
      city: "北京",
      tags: ["Agent"],
      contactPrivate: "wx_abc",
      body: {
        projectStage: "有MVP",
        intro: "做企业客服Agent",
        techNeeds: "需要全栈",
        cooperationModes: [],
      },
    });
    expect(r.ok).toBe(false);
  });
  it("accepts valid partner", () => {
    const r = parsePostInput({
      type: "partner",
      title: "企业级AI客服Agent，已获种子轮，缺CTO",
      city: "北京",
      tags: ["Agent"],
      contactPrivate: "wx_abc",
      body: {
        projectStage: "已融资",
        intro: "做企业客服Agent，已有付费试点",
        techNeeds: "大模型应用 + 后端架构",
        cooperationModes: ["股权合伙"],
      },
    });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- src/tests/filters.test.ts src/tests/schemas.test.ts
```

- [ ] **Step 3: Implement schemas + filters**

Use Zod. Title max 50; intro/tech text limits per spec (300/200). Types:

```ts
export type CreatePostInput = {
  type: "partner" | "talent" | "project" | "funding";
  title: string;
  city: string;
  tags: string[];
  contactPrivate: string;
  body: Record<string, unknown>;
};
```

Partner required: `projectStage`, `intro`, `techNeeds`, `cooperationModes` (non-empty array).  
Talent: `status`, `background`, `timeCommitment`, `desiredModes` (non-empty).  
Project: `projectKind`, `techNeeds`, `workMode`.  
Funding: `stage`, `amount`, `intro`, `team`.

```ts
// src/lib/posts/filters.ts
import { Prisma, PostType } from "@prisma/client";

export function buildPostWhere(q: {
  city?: string;
  type?: string;
  tags?: string[];
}): Prisma.PostWhereInput {
  const where: Prisma.PostWhereInput = { status: "active" };
  if (q.city && q.city !== "全部") where.city = q.city;
  if (q.type && q.type !== "all") where.type = q.type as PostType;
  if (q.tags?.length) {
    where.AND = q.tags.map((t) => ({ tags: { has: t } }));
  }
  return where;
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/posts src/tests/filters.test.ts src/tests/schemas.test.ts
git commit -m "feat: add post validation schemas and list filters"
```

---

### Task 7: Unlock state machine + contact visibility (unit TDD)

**Files:**
- Create: `src/lib/unlock/state.ts`, `src/lib/posts/visibility.ts`, `src/tests/unlock-state.test.ts`, `src/tests/visibility.test.ts`

**Interfaces:**
- Produces:
  - `canCreateUnlockRequest(...): { ok: true } | { ok: false; error: string }`
  - `nextUnlockStatus(current, action: "approve"|"reject"): UnlockStatus`
  - `shouldRevealContact(input): boolean`

- [ ] **Step 1: Failing tests**

```ts
// src/tests/unlock-state.test.ts
import { describe, expect, it } from "vitest";
import { canCreateUnlockRequest, nextUnlockStatus } from "@/lib/unlock/state";

describe("canCreateUnlockRequest", () => {
  it("blocks own post", () => {
    expect(
      canCreateUnlockRequest({
        authorId: "u1",
        requesterId: "u1",
        message: "你好我是前阿里P8想聊聊",
        pendingToday: 0,
        existingStatus: null,
        postStatus: "active",
      }).ok,
    ).toBe(false);
  });
  it("blocks short message", () => {
    expect(
      canCreateUnlockRequest({
        authorId: "a",
        requesterId: "b",
        message: "hi",
        pendingToday: 0,
        existingStatus: null,
        postStatus: "active",
      }).ok,
    ).toBe(false);
  });
  it("blocks second pending", () => {
    expect(
      canCreateUnlockRequest({
        authorId: "a",
        requesterId: "b",
        message: "你好我是前阿里P8想聊聊",
        pendingToday: 0,
        existingStatus: "pending",
        postStatus: "active",
      }).ok,
    ).toBe(false);
  });
});

describe("nextUnlockStatus", () => {
  it("approve/reject from pending", () => {
    expect(nextUnlockStatus("pending", "approve")).toBe("approved");
    expect(nextUnlockStatus("pending", "reject")).toBe("rejected");
  });
});
```

```ts
// src/tests/visibility.test.ts
import { describe, expect, it } from "vitest";
import { shouldRevealContact } from "@/lib/posts/visibility";

describe("shouldRevealContact", () => {
  it("author always", () => {
    expect(
      shouldRevealContact({ viewerId: "a", authorId: "a", unlockStatus: null }),
    ).toBe(true);
  });
  it("approved requester", () => {
    expect(
      shouldRevealContact({
        viewerId: "b",
        authorId: "a",
        unlockStatus: "approved",
      }),
    ).toBe(true);
  });
  it("others false", () => {
    expect(
      shouldRevealContact({
        viewerId: "b",
        authorId: "a",
        unlockStatus: "pending",
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/lib/unlock/state.ts
import { UNLOCK_MAX_PENDING_PER_DAY, UNLOCK_MIN_MESSAGE_LEN } from "@/lib/constants";

export function canCreateUnlockRequest(input: {
  authorId: string;
  requesterId: string;
  message: string;
  pendingToday: number;
  existingStatus: "pending" | "approved" | "rejected" | null;
  postStatus: "active" | "hidden";
}): { ok: true } | { ok: false; error: string } {
  if (input.postStatus !== "active") return { ok: false, error: "帖子不可用" };
  if (input.authorId === input.requesterId) {
    return { ok: false, error: "不能申请自己的帖子" };
  }
  if (input.message.trim().length < UNLOCK_MIN_MESSAGE_LEN) {
    return { ok: false, error: "请简单介绍一下你自己" };
  }
  if (input.existingStatus === "pending") {
    return { ok: false, error: "已有待处理申请" };
  }
  if (input.existingStatus === "approved") {
    return { ok: false, error: "已通过，可直接查看" };
  }
  if (input.pendingToday >= UNLOCK_MAX_PENDING_PER_DAY) {
    return { ok: false, error: "今日申请次数已达上限" };
  }
  return { ok: true };
}

export function nextUnlockStatus(
  current: "pending" | "approved" | "rejected",
  action: "approve" | "reject",
): "approved" | "rejected" {
  if (current !== "pending") throw new Error("invalid transition");
  return action === "approve" ? "approved" : "rejected";
}
```

```ts
// src/lib/posts/visibility.ts
export function shouldRevealContact(input: {
  viewerId: string | null;
  authorId: string;
  unlockStatus: "pending" | "approved" | "rejected" | null;
}): boolean {
  if (!input.viewerId) return false;
  if (input.viewerId === input.authorId) return true;
  return input.unlockStatus === "approved";
}
```

- [ ] **Step 3: Run tests PASS + commit**

```bash
npm test
git add src/lib/unlock src/lib/posts/visibility.ts src/tests/unlock-state.test.ts src/tests/visibility.test.ts
git commit -m "feat: add unlock rules and contact visibility helpers"
```

---

### Task 8: Posts API + publish UI

**Files:**
- Create: `src/app/api/posts/route.ts`, `src/app/api/posts/[id]/route.ts`, `src/app/posts/new/page.tsx`, `src/components/PostForm.tsx`

**Interfaces:**
- `GET /api/posts?city&type&tags` → list without `contactPrivate`
- `POST /api/posts` auth required → create
- `GET /api/posts/[id]` → detail; include `contactPrivate` only if `shouldRevealContact`
- `PATCH /api/posts/[id]` author/admin: `{ status: "hidden" }` or bump

- [ ] **Step 1: Implement list/create route**

```ts
// src/app/api/posts/route.ts — sketch
// GET: prisma.post.findMany({ where: buildPostWhere(...), orderBy: { bumpedAt: "desc" }, include: { author: { select: { id, nickname, city, roleTag } } }, take: 50 })
// map rows to omit contactPrivate
// POST: getSessionUser(); parsePostInput; prisma.post.create; return { id }
```

- [ ] **Step 2: Implement detail + hide**

On GET by id: load post; if hidden and viewer not author/admin → 404; increment `viewCount`; load unlock for viewer; compute `reveal = shouldRevealContact(...)`; strip contact unless reveal.

PATCH: author or admin may set `status: hidden`; author may set `bumpedAt: now()`.

- [ ] **Step 3: `PostForm` + `/posts/new`**

Three steps in one page state: (1) pick type cards (2) fields from schema + contact input + tags (3) preview → POST. Redirect to `/posts/[id]`. Unauthenticated → `/login?next=/posts/new`.

- [ ] **Step 4: Manual** — create one of each type with dry-run user.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/posts src/app/posts/new src/components/PostForm.tsx
git commit -m "feat: add post create API and publish form"
```

---

### Task 9: Home list + detail UI

**Files:**
- Create: `src/components/PostCard.tsx`, `src/components/FilterBar.tsx`
- Modify: `src/app/page.tsx`, create `src/app/posts/[id]/page.tsx`

- [ ] **Step 1: FilterBar + PostCard**

FilterBar: city chips, type chips (含全部), tag multi-select; updates URL searchParams (`?city=&type=&tags=` comma-separated).

PostCard: type color, title, city, tags, snippet from `body.intro` or `body.background`, meta time/views. Link to detail.

- [ ] **Step 2: Home `page.tsx` (server)**

Read searchParams → `buildPostWhere` → query posts → render FilterBar + list. Empty state:「暂无帖子，来发布第一条」.

- [ ] **Step 3: Detail page**

Show structured body fields with labels; publisher card; disclaimer; placeholder slot for unlock panel (Task 10).

- [ ] **Step 4: Manual filter combinations**

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/posts/[id]/page.tsx src/components/PostCard.tsx src/components/FilterBar.tsx
git commit -m "feat: add home filters and post detail page"
```

---

### Task 10: Contact unlock API + `/me` inbox

**Files:**
- Create: `src/app/api/posts/[id]/unlock/route.ts`, `src/app/api/unlock/[requestId]/route.ts`, `src/components/ContactUnlockPanel.tsx`, `src/app/me/page.tsx`

**Interfaces:**
- `POST /api/posts/[id]/unlock` `{ message }`
- `POST /api/unlock/[requestId]` `{ action: "approve" | "reject" }` — only post author

- [ ] **Step 1: Unlock create route**

Load post + existing unique request + count pending today for requester; `canCreateUnlockRequest`; if previous was `rejected`, allow new row by deleting old or upsert — **spec: one open pending**; for rejected, upsert message and set status back to `pending` (document this behavior in code comment).

- [ ] **Step 2: Approve/reject route**

Verify session user === post.authorId; `nextUnlockStatus`; set `decidedAt`.

- [ ] **Step 3: ContactUnlockPanel**

States: logged-out CTA; form; pending; approved+show contact; rejected. Wire into detail page.

- [ ] **Step 4: `/me` page**

Tabs: 我的帖子 (hide/bump buttons), 联系方式申请 (incoming pending with approve/reject; outgoing list). Profile summary.

- [ ] **Step 5: Manual two-browser test** — unlock → approve → contact visible only to requester.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/posts src/app/api/unlock src/components/ContactUnlockPanel.tsx src/app/me
git commit -m "feat: add contact unlock flow and me inbox"
```

---

### Task 11: AI polish

**Files:**
- Create: `src/lib/ai/polish.ts`, `src/app/api/ai/polish/route.ts`, `src/components/AiPolishBlock.tsx`
- Modify: `src/components/PostForm.tsx`

**Interfaces:**
- `POST /api/ai/polish` `{ type, fields: Record<string,string> }` → `{ ok: true, fields }` | `{ ok: false, error }`
- Auth required; strip any keys named like contact/phone/微信

- [ ] **Step 1: polish helper**

```ts
// src/lib/ai/polish.ts
const BLOCKED = /contact|phone|微信|手机|邮箱|email/i;

export function sanitizePolishFields(fields: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (BLOCKED.test(k) || BLOCKED.test(v)) continue;
    out[k] = v;
  }
  return out;
}

export async function polishFields(
  type: string,
  fields: Record<string, string>,
): Promise<Record<string, string>> {
  const safe = sanitizePolishFields(fields);
  const key = process.env.LLM_API_KEY;
  if (!key) throw new Error("LLM not configured");
  const res = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
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
          content: JSON.stringify({ type, fields: safe }),
        },
      ],
      temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error("LLM failed");
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  const json = JSON.parse(text.replace(/^```json\n?|\n?```$/g, ""));
  return sanitizePolishFields(json);
}
```

- [ ] **Step 2: API route** — try/catch → `{ ok: false, error: "润色暂不可用" }` with 503; never block publish.

- [ ] **Step 3: AiPolishBlock** — button 一键润色; show result; 采用 copies into form state; 放弃 dismisses. Form remains submittable on failure.

- [ ] **Step 4: Manual** — with and without `LLM_API_KEY`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai src/app/api/ai src/components/AiPolishBlock.tsx src/components/PostForm.tsx
git commit -m "feat: add AI draft polish with adopt/discard"
```

---

### Task 12: Seed script + deploy notes + launch checklist

**Files:**
- Create: `prisma/seed.ts`, `docs/deploy-aliyun.md`
- Modify: `package.json` prisma seed config

- [ ] **Step 1: Seed 12–16 posts**

Create 2 fake users (phones `13900000001`, `13900000002`), mix of 4 types across cities/tags, realistic Chinese copy. Never put real secrets in seed contacts (use `wx_seed_demo`).

```json
// package.json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

```bash
npx prisma db seed
```

- [ ] **Step 2: Write `docs/deploy-aliyun.md`**

Contents: ECS/轻量 Node 20+; install deps; `prisma migrate deploy`; systemd or pm2 `next start`; Nginx reverse proxy HTTPS; env vars from `.env.example`; RDS backup tip; SMS console template; set `SMS_DRY_RUN=false` in prod; ICP note.

- [ ] **Step 3: Paste manual launch checklist** (from spec §8.2) at end of deploy doc as checkboxes.

- [ ] **Step 4: Run full unit suite**

```bash
npm test
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts docs/deploy-aliyun.md package.json
git commit -m "chore: add seed data and Aliyun deploy notes"
```

---

## Plan self-review

| Spec item | Task |
|-----------|------|
| Phone OTP + limits | 2, 4, 5 |
| Four post types + templates | 6, 8 |
| Browse city/type/tags | 6, 9 |
| Contact unlock | 7, 10 |
| AI polish | 11 |
| Soft-hide admin/author | 8, 10 |
| Seed posts | 12 |
| Aliyun deploy | 12 |
| No comments/DMs/KYC | omitted by design |

Type names aligned: `PostType`, `UnlockStatus`, `shouldRevealContact`, `canCreateUnlockRequest`, `parsePostInput`, `buildPostWhere`.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-21-ai-partner-marketplace.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — run tasks in this session with executing-plans checkpoints  

Which approach?
