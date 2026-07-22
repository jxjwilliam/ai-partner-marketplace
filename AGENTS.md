# AGENTS.md

Instructions for AI coding agents working in this repository.

## What this product is

**AI合伙人集市** — China-mainland Craigslist-style board for senior tech talent ↔ AI founders/projects. Chinese UI. Platform is info-only; no deal mediation.

Canonical product decisions live in:

`docs/superpowers/specs/2026-07-21-ai-partner-marketplace-design.md`

That design **overrides** older drafts under `docs/` (Kimi PRD, Doubao/DeepSeek notes) when they conflict.

## Non-negotiables

1. **Contact privacy:** `contactPrivate` must never appear in list APIs or public SSR payloads unless `shouldRevealContact(...)` is true (author or approved unlock requester). Prefer `select` that omits the field when only counting/updating other columns.
2. **Chinese user-facing copy** for UI and API error strings.
3. **Phone OTP only** for auth in v1 — no WeChat/email/OAuth login unless the design is explicitly revised.
4. **SMS fail-closed:** never claim “sent” if the provider call fails; do not leave a usable OTP that was not delivered (see reservation/rollback pattern in send-otp).
5. **LLM polish:** never send phone/contact into prompts; sanitize keys *and* values; polish failure must not block publish (`润色暂不可用`).
6. **v1 out of scope:** comments, DMs, Elasticsearch, payments, mini-program, App, WeChat KYC. Do not add them “while you’re here.”

## Architecture map

| Area | Location | Notes |
|------|----------|--------|
| Routes / API | `src/app/` | App Router; Route Handlers under `src/app/api/` |
| UI | `src/components/` | Keep pages thin; logic in lib where testable |
| Auth | `src/lib/auth/` | OTP helpers, session cookie, SMS adapter |
| Posts | `src/lib/posts/` | Zod `parsePostInput`, `buildPostWhere`, visibility |
| Unlock | `src/lib/unlock/` | `canCreateUnlockRequest`, `nextUnlockStatus` |
| AI | `src/lib/ai/polish.ts` | Sanitize + OpenAI-compatible client |
| Schema | `prisma/schema.prisma` | Tables mapped to snake_case via `@@map` |
| Tests | `src/tests/` | Vitest; prefer unit + mocked route tests |

Shared constants (cities, tags, rate limits): `src/lib/constants.ts`.

## How to work

### Before coding

- Read the design spec section that owns your change.
- Prefer extending existing helpers over duplicating rate-limit / visibility logic in routes.
- Keep files focused; do not grow god-components without a clear reason.

### Commands

```bash
npm test              # required before claiming done
npm run lint
npm run build         # when touching routes/pages/types
npx prisma validate   # when changing schema
```

Local SMS: `SMS_DRY_RUN=true` (codes in server logs). Do not commit `.env`.

### Testing expectations

- Pure logic (OTP limits, filters, unlock state, polish sanitize) → unit tests with TDD when adding behavior.
- Route auth/privacy paths → mocked Prisma/session tests that assert contact is stripped and Chinese errors return.
- Do not claim live SMS/RDS/browser verification unless you actually ran it against a reachable DB and real (or dry-run) SMS.

### Commits

- Small, purposeful commits; message focuses on why.
- Never commit secrets, `.env`, or real phone numbers in seed/fixtures (use `wx_seed_demo`-style fakes).

## Rate limits (do not weaken without design change)

- OTP: 60s cooldown; 5 verify attempts/code; 10 sends/phone/day; 20 sends/IP/day
- Unlock: 5 pending requests/requester/day; one open pending per (requester, post); min intro length from constants

Preserve OTP send history rows used for daily counts (do not wipe all OTP rows on successful login).

## Deploy

Production target is 阿里云 ECS/轻量 + RDS. Follow `docs/deploy-aliyun.md`. Nginx must overwrite `X-Forwarded-For` (do not trust client spoofing for IP rate limits).

## Docs index

| Path | Role |
|------|------|
| `README.md` | Human setup overview |
| `docs/superpowers/specs/*-design.md` | Product source of truth |
| `docs/superpowers/plans/*` | Implementation plan (historical task checklist) |
| `docs/deploy-aliyun.md` | Ops + launch checklist |
| `docs/*.md` (other) | Research / draft PRD — not binding |

## When unsure

Ask before: adding new auth providers, changing contact visibility rules, introducing Redis/search/payments, or expanding beyond the four post types without a design update.
