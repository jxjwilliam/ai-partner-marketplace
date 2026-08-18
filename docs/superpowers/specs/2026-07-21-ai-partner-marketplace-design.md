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
- Discussion/comments (explicitly deferred; not in v1 acceptance)
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
| LLM | Mainland-reachable API for polish only (e.g. 通义/百炼; Kimi if reachable) |

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
OSS (optional assets)   LLM API (润色 only)
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

### 4.2 UI building blocks

- `PostCard` — title, tags, city, snippet, meta
- `FilterBar` — city / type / tag chips
- `PostForm` — one schema per post type
- `ContactUnlockPanel` — request → pending / revealed / denied
- `AiPolishBlock` — call API, show result, adopt/discard
- `AuthGate` — write actions require login

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
- Comments/discussion
- WeChat login / real-name KYC
- Serverless (FC) or mini-program
- Email/SMS push for unlock decisions
- Full-text search and paid pin
