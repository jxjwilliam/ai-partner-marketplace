# AI合伙人集市 — MVP Design Spec

> **Date:** 2026-07-21  
> **Status:** Draft for user review  
> **Source:** Brainstorming over `docs/` research + Kimi PRD; decisions locked in session

---

## 1. Goal

Ship a China-mainland web MVP: a Craigslist-style information board where **35+/10yr+ tech talent** and **AI founders/projects** post and connect, without the platform mediating deals.

**One-liner:** 国内面向资深技术人的 AI 创业合伙信息集市 — 极简发帖、个人直连、联系方式需申请解锁。

### 1.1 Success (4–6 weeks after launch)

| Priority | Bar |
|----------|-----|
| Primary | ~50+ real posts (mix of 我是人才 / 找合伙人); ≥70% look senior-quality (years, stack, clear 合作方式) |
| Secondary | ≥10 contact unlocks (approved requests) |
| Stretch | 2–3 anecdotal “we talked / might collaborate” stories |
| Non-goals | Revenue, AI matching, 1000 users, WeChat real-name KYC |

### 1.2 In scope (v1)

- Phone OTP login
- Four post types with structured templates
- Browse + filter (city, type, tags)
- Contact-request unlock flow
- AI polish on draft (adopt/discard)
- Minimal admin: soft-hide spam posts
- Seed 10–20 sample posts before invites

### 1.3 Out of scope (v1)

- WeChat scan login / real-name KYC
- ~~Discussion/comments~~ → 2026-08-18 修订：移入 v1.1 社区动态区（动态/评论已实现，见文末修订节）
- Search (Elasticsearch), DMs, pin/pay, AI matching
- Full admin console, mini-program, App
- Redis (add only if list latency becomes a measured problem)

---

## 2. Constraints & decisions

| Topic | Decision |
|-------|----------|
| Product shape | Full web MVP (not community-only first) |
| Feature cut | P0 + thin P1: contact unlock + AI polish |
| Auth | Mainland phone OTP (阿里云短信服务) + 邮箱魔法链接 + Google OAuth（Supabase Auth；2026-08-18 修订） |
| Audience / geo | China mainland, Chinese UI |
| Hosting | 阿里云 (account available): ECS/轻量 + RDS PostgreSQL + OSS optional |
| Approach | Classic Aliyun monolith (not serverless-first, not mini-program-first) |
| Stack | Next.js 15 (App Router) + PostgreSQL + Tailwind (+ shadcn/ui as needed) |
| LLM | Mainland-reachable API for polish + 推荐理由 (e.g. 通义/百炼; 当前用 DeepSeek) |

Background research and a fuller PRD live in `docs/`; this spec **overrides** the PRD where they conflict (auth, hosting, deferred P1 items).

---

## 3. Architecture

```
Browser (PC + mobile web)
    ↓
Next.js 15 (App Router) on 阿里云 ECS / 轻量应用服务器
    ├── Server Actions / Route Handlers (auth, posts, unlock, AI)
    ├── Session cookie (phone-verified users)
    ↓
RDS PostgreSQL          短信服务 (OTP)
OSS (optional assets)   LLM API (润色 + 推荐理由)
```

### 3.1 Units

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| Auth | Send/verify OTP, email magic link, Google OAuth, session, basic profile | 短信服务 / Supabase Auth, `users` / `otp_codes` / `sessions` |
| Posts | CRUD four templates; list/filter | `posts` |
| Unlock | Request → approve/reject → reveal contact | `contact_requests`, Auth |
| AI polish | Rewrite draft fields; user adopts or discards | LLM API (no contact/phone in prompts) |
| Admin (minimal) | Soft-hide spam (`status = hidden`); sole admin flag | `users.is_admin` |

### 3.2 Deploy sketch

- One ECS/轻量 + Nginx + HTTPS domain
- Env secrets: DB, SMS, LLM, session secret
- Nightly RDS backup
- ICP: required for open public China hosting on a custom domain; private invite / friends-and-family testing may use IP or restricted access until ICP is ready — operator decides timing, product build does not block on ICP

---

## 4. Pages & components

### 4.1 Routes

| Route | Purpose |
|-------|---------|
| `/` | City + type + tag filters; post list (time / bumped desc) |
| `/posts/new` | Type → template form (+ AI polish) → preview/publish |
| `/posts/[id]` | Detail, publisher card, contact unlock CTA |
| `/me` | Profile basics, my posts, unlock requests (in/out) |
| `/login` | Phone + OTP / 邮箱魔法链接 / Google 登录 |
| `/community` | 社区动态流：发布/评论动态（2026-08-18 修订） |
| `/recommendations` | AI 匹配推荐：分页列表 + 后台/手动 LLM 理由生成（2026-08-19 修订） |

### 4.2 UI building blocks

- `PostCard` — title, tags, city, snippet, meta
- `FilterBar` — city / type / tag chips
- `PostForm` — one schema per post type
- `ContactUnlockPanel` — request → pending / revealed / denied
- `AiPolishBlock` — call API, show result, adopt/discard
- `AuthGate` — write actions require login
- `CommunityComposer` / `CommentList` / `DeleteButton` — 社区动态与评论（2026-08-18 修订）

### 4.3 Visual direction

- Craigslist density: high information, light chrome
- Semantic color by post type (partner / talent / project / funding)
- Chinese-first; mobile-usable list and forms
- Home is one composition: brand + filters + list + 发布 — not a dashboard of widgets

### 4.4 Seed content

Script or admin-seeded ~10–20 sample posts across types/cities/stacks so first invitees are not staring at an empty board.

---

## 5. Data model

### 5.1 Tables

**`users`**  
id, phone (unique), nickname, city, role_tag (`talent` | `founder` | `investor` | `other`), bio, is_admin, created_at

**`otp_codes`**  
phone, code_hash, expires_at, attempts — short-lived; purge expired rows

**`sessions`**  
token_hash, user_id, expires_at

**`posts`**  
id, author_id, type (`partner` | `talent` | `project` | `funding`), title, city, tags[], body_json (template fields), contact_private, status (`active` | `hidden`), view_count, created_at, bumped_at

**`contact_requests`**  
id, post_id, requester_id, message, status (`pending` | `approved` | `rejected`), created_at, decided_at

> **2026-08-18 修订新增：** `sf_community_posts`（动态）、`sf_comments`（动态/帖子评论）——
> 结构与规则见文末修订节 §12.3；迁移文件 `supabase/migrations/20260818223000_sf_community.sql`。

### 5.2 body_json templates (required fields)

Align with Kimi PRD templates; store extras in JSON:

- **partner (找合伙人):** project stage, intro, tech needs, cooperation modes (multi), optional equity/salary, optional team
- **talent (我是人才):** status, background, time commitment, desired modes, optional portfolio link
- **project (接项目):** project kind, budget/cycle optional, tech needs, remote/onsite
- **funding (找资金):** stage, amount, optional equity, intro, team

### 5.3 Access rules

- List/detail APIs never return `contact_private` except to the author or an approved requester
- Public reads only `status = active`

---

## 6. Flows

1. **Login:** phone → SMS OTP → verify → session；邮箱 → 魔法链接 → 回调 → session；或 Google → OAuth 弹窗 → 回调 → session → optional onboarding (nickname, city, role)
2. **Publish:** auth → pick type → fill template → optional AI polish → submit → `/posts/[id]`
3. **Browse:** public; filters city + type + tags (AND); sort by `bumped_at` / `created_at` desc
4. **Unlock:** intro message → pending → author decide on `/me` → approve reveals contact on detail; reject does not
5. **Hide:** author hides own post; admin can hide spam

**Notifications (v1):** in-app only on `/me` (no SMS/email push).

**Rate limits (v1 defaults):**
- OTP: 60s cooldown between sends; max 5 verify attempts per code; max 10 sends per phone per day; max 20 sends per IP per day
- Unlock: max 5 pending requests per requester per day; one open pending per (requester, post) pair

---

## 7. Trust, errors & edge cases

### 7.1 Trust

- Contact gated until approve (v1 always gated)
- Unlock requires minimum-length intro
- Soft publish gates: required 合作方式 / 项目阶段 where applicable
- Footer + detail disclaimer: info-only platform; contracts offline
- Footer 举报 / contact email; admin hide — no full report UI required in v1

### 7.2 Auth / SMS failures

- Clear Chinese errors; fail closed on SMS outage (never claim “sent” if not)
- Session: httpOnly, Secure, SameSite; logout clears server session

### 7.3 AI polish

- LLM down → form still submittable
- Never auto-overwrite without adopt
- Do not send phone or contact into LLM prompts

### 7.4 Unlock edges

- No request on own post
- One open pending per requester/post
- Hidden/deleted post closes requests; no reveal

---

## 8. Testing & launch

### 8.1 Automated

- Unit: OTP helpers; filter builders; unlock state machine
- Integration (test DB): register → publish 4 types → filter → unlock approve/reject contact visibility
- Full E2E optional later

### 8.2 Manual launch checklist

1. Real mainland number OTP login
2. All four templates publish and filter correctly
3. Second account unlock → approve → contact only for requester
4. AI polish adopt/discard; publish works if LLM fails
5. Hide removes from public list
6. Mobile (Safari / WeChat in-app browser) usable
7. Seed posts live before real invites

---

## 9. Implementation order (guidance for plan)

1. Project scaffold on Aliyun + RDS + env
2. Auth (OTP + session + `/login` + onboarding)
3. Posts schema + publish + list/detail + filters
4. Contact unlock + `/me` request inbox
5. AI polish block
6. Seed script + admin hide
7. Deploy HTTPS + launch checklist

---

## 10. Deferred (post-v1 only)

- ICP filing and fully open public DNS
- ~~Comments/discussion~~ → 已移入 v1.1 社区动态区（2026-08-18 修订）
- WeChat login / real-name KYC
- Serverless (FC) or mini-program
- Email/SMS push for unlock decisions
- Full-text search and paid pin

---

# 修订 2026-08-18 — 社区动态区（Community MVP）+ 双面市场定位

> 状态：已实现 MVP。本修订覆盖第 1、2、10 节中与“评论/讨论”相关的旧约定
> （评论区/动态区从 deferred 移入 v1.1 范围；其余 deferred 项不变）。

## 11. 定位（双面市场，不是单边社区）

平台同时服务两类用户，首页分别给出价值主张，但共用同一份帖子数据：

| 一侧 | 谁来 | 为什么来 | 对应帖子类型 |
|------|------|----------|--------------|
| 资深专业人士（35+/10 年+） | 技术人、架构师、产品/运营老兵 | 找合伙人、接项目、被企业/项目方看见；资历前置、联系方式不裸奔 | 找合伙人、我是人才 |
| 企业 / 投资人 | 创业项目方、企业用人方、投资机构 | 按技能/城市/类型精准筛选资深人才与真实项目，申请解锁直连 | 接项目、找资金 |

平台特色保持三句话：**资历前置**（35+优先、10 年+、股权合伙）、**联系方式申请解锁**
（隐私保护 + 意向过滤）、**只做信息撮合**（不介入交易、不背书）。

## 12. 社区动态区（Community MVP）

### 12.1 目的

给资深技术人一个低门槛的交流空间：分享踩坑/经验、找队友、晒作品、提问。
与帖子集市互补——帖子是结构化机会，动态是非结构化的“人在场”信号。
评论统一复用一套表，同时支持动态评论和帖子详情评论。

### 12.2 范围

**In scope（本次实现）**

- `/community` 动态流：登录用户发布文字动态，公开可读，新帖在前。
- 动态评论 + 帖子详情评论：登录用户评论，公开可读。
- 作者可删除自己的动态/评论；`status=hidden` 预留给管理员隐藏（软删除字段）。
- 防垃圾：长度上限、每日条数上限、发布内容自动脱敏联系方式。

**Out of scope（本次不做）**

- 点赞/收藏/关注、富文本/图片、@提及、私信、搜索、完整论坛版块/子版。
- 评论不承载联系方式解锁；联系方式仍只能通过 unlock 流程获得。

### 12.3 数据模型（新增两张表）

**`sf_community_posts`** — 动态

| 列 | 类型 | 说明 |
|----|------|------|
| id | text (PK, gen_random_uuid) | |
| author_id | text FK → sf_users.id (CASCADE) | |
| body | text | 1–1000 字，写入前脱敏 |
| status | PostStatus | active / hidden |
| created_at | timestamptz | |

**`sf_comments`** — 评论（动态评论或帖子评论二选一）

| 列 | 类型 | 说明 |
|----|------|------|
| id | text (PK, gen_random_uuid) | |
| author_id | text FK → sf_users.id (CASCADE) | |
| community_post_id | text FK → sf_community_posts.id (CASCADE, nullable) | 动态评论 |
| listing_post_id | text FK → sf_posts.id (CASCADE, nullable) | 帖子评论 |
| body | text | 1–500 字，写入前脱敏 |
| status | PostStatus | active / hidden |
| created_at | timestamptz | |

约束：`community_post_id` 与 `listing_post_id` 恰有一个非空（CHECK）。
索引：FK 列 + 排序列（community_post_id, created_at / listing_post_id, created_at /
author_id）。RLS 与既有 `sf_` 表一致：启用 RLS、无策略、仅 service_role 可读写。

### 12.4 规则

- 读写可见性：公开可读（匿名可看）；**写操作必须登录**。
- 文本校验：trim 后非空；动态 ≤1000 字、评论 ≤500 字。
- 脱敏：写入前复用 `scrubContactText`，手机号/邮箱/微信号替换为 `[已隐藏]`，
  防止评论绕过 unlock 泄露联系方式。
- 频率限制：每人每天动态 ≤20 条、评论 ≤50 条（计数基于 created_at 当日）。
- 删除：作者可删自己的动态（级联删其评论）或评论；管理员后续用 status=hidden 隐藏。
- 全站文案中文；错误提示中文；不发送评论内容给 LLM。

### 12.5 页面与 API

| 路径 | 方法 | 说明 |
|------|------|------|
| `/community` | GET | 动态流（SSR，分页 20/页，内嵌评论） |
| `/api/community` | POST | 登录后发布动态 |
| `/api/community/[id]` | DELETE | 删除自己的动态 |
| `/api/comments` | POST | 登录后评论（targetType: community / listing） |
| `/api/comments/[id]` | DELETE | 删除自己的评论 |
| `/posts/[id]` | GET | 详情页新增评论区块（SSR 内嵌评论） |

导航：顶栏新增「社区」入口（MessageSquare 图标，选中高亮）。

### 12.6 风险与后续

- 垃圾/人身攻击：MVP 靠长度 + 频率限制兜底，后续补管理员隐藏 API 与举报。
- 内容安全（合规）：上线前建议接入机审（阿里云内容安全）扫描动态/评论；本次不实现。
- 动态中的联系方式一律脱敏，避免“先看评论再决定要不要 unlock”破坏解锁闭环。

# 修订 2026-08-19 — AI 匹配推荐（异步 LLM 升级）

## 13. AI 匹配推荐（Recommendations v2）

### 13.1 目标

LLM 生成推荐理由不应阻塞任何页面渲染：DeepSeek 变慢/不可用时，
首页与推荐页都即时展示规则评分结果，LLM 理由异步生成后覆盖缓存。

### 13.2 行为

- 首页「为你推荐」：只读 30 分钟缓存（命中 LLM 理由则直接展示），
  未命中时用规则评分 + 规则文案即时渲染，**不等待、不调用 LLM**。
- `/recommendations`：分页展示（每页 5 条，缓存 20 条，`RECOMMENDATIONS_PAGE_SIZE`
  / `RECOMMENDATIONS_CACHE_SIZE`）；首屏秒出规则结果并写入缓存（`llm=false`）。
- 异步升级：前端检测到缓存中无 AI 理由（`llmReady=false`）时，后台自动调用
  `POST /api/recommendations/refresh` 生成 LLM 理由并覆盖缓存（`llm=true`）；
  页面上提示「AI 理由生成中…当前展示规则匹配结果」，完成后自动刷新。
- 手动刷新：「刷新推荐」按钮走同一接口，失败保留规则文案并提示。
- 缓存：`sf_recommendations` 30 分钟 TTL；新增 `llm BOOLEAN NOT NULL DEFAULT false`
  标记区分规则结果与 LLM 理由（迁移 `20260818234000_sf_recommendations_llm.sql`）；
  upsert 时显式刷新 `created_at`，避免 TTL 停留在旧行。
- 导航：顶栏「推荐」入口 hover/focus 时预取第一页，暖缓存。
