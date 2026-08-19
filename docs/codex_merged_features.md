# AI合伙人集市 —— 双项目合并说明

> 日期：2026-08-12
> 状态：已实施（v1 完成，随 `senior-fusion-platform` 仓库维护；2026-08-18 追加
> 社区动态区/评论、首页双面价值入口、lucide 图标、城市扩充与导航高亮）
> 生成：Codex（命名前缀遵循 docs/ 目录约定）

## 1. 背景与结论

项目由两个原型合并升级而来：

- **ai-partner-marketplace**：Vite + React 前端原型，亮点是产品设计与交互（专业极简商务风、搜索、分类入口、排序、认证徽章），数据为 mock。
- **senior-fusion-platform**：Next.js 15 全栈 MVP，功能可落地（手机 OTP 登录、四类结构化帖子、联系方式解锁、AI 润色、个人中心、限流与隐私保护），界面朴素。

合并策略：**以 senior-fusion-platform 为底座，把 marketplace 的可落地特点移植进来，再叠加调研得到的 AI 匹配推荐**。两个应用的功能特点已基本全部合并；与产品定位冲突或依赖外部资源的部分被明确排除（见 §5）。

## 2. 合并原则

1. 功能优先：凡能直接落地、不依赖外部新资源的 marketplace 特点一律移植。
2. 隐私与安全不变量不变：联系方式解锁、手机号/联系方式不进 LLM、fail-closed SMS。
3. 中国市场的部署约束：阿里云 ECS + Supabase 托管 Postgres；LLM 使用大陆可达的 DeepSeek 兼容端点。
4. 不为了“看起来完整”引入 mock 数据或无关依赖。

## 3. 从 ai-partner-marketplace 吸收的功能

| 原特点 | 新应用现状 |
|--------|-----------|
| 深蓝 `#1F3A5F` + 活力青 `#06B6D4` 专业商务视觉 | ✅ 全站统一（导航、卡片、按钮、表单、`globals.css` 品牌色变量） |
| Hero 区 + 关键词搜索 | ✅ 首页 Hero + 搜索框；服务端搜索标题与 `intro/background/techNeeds/projectStage` |
| 分类入口卡片 | ❌ 2026-08-18 移除（与筛选栏「类型」重复）；类型筛选统一走 `FilterBar`（城市/类型/标签） |
| 城市 / 标签筛选 | ✅ 保留并重设计（`FilterBar`） |
| 排序下拉 | ✅ 最新发布 / 热度最高（“讨论最多”未做，见 §5） |
| 帖子卡片：已认证徽章、浏览量、作者、相对时间 | ✅ `PostCard` 全部实现 |
| 加载更多 | ✅ 服务端分页 + “加载更多”链接 |
| 404 页 | ✅ 等价实现（Next.js `not-found`） |

## 4. 从 senior-fusion-platform 保留并增强

| 能力 | 现状 |
|------|------|
| 手机号 OTP 登录（阿里云短信） | ✅ 保留；`SMS_DRY_RUN` 本地调试 |
| 四类结构化帖子（找合伙人/我是人才/接项目/找资金） | ✅ 保留，Zod 校验 |
| 联系方式申请解锁（作者批准后才可见） | ✅ 保留，隐私不变量未改 |
| 发帖 AI 润色（采用/放弃） | ✅ 保留；改用 `OPENAI_COMPATIBLE_*` 变量（当前 DeepSeek） |
| 个人中心（我的帖子/隐藏/刷新/申请收件箱） | ✅ 保留 |
| 管理员软隐藏 | ✅ 保留 |
| 限流与安全（OTP 频控、解锁每日上限、联系方式脱敏） | ✅ 保留 |
| 测试与种子数据 | ✅ 保留并更新；`scripts/seed.ts` 幂等灌入 Supabase |
| 数据层 | 🔄 从本地 PostgreSQL + Prisma 迁移到 **Supabase + supabase-js（service_role）**，表统一 `sf_` 前缀，RLS 默认拒绝匿名 |

## 5. 调研后新增

参考 GitHub 开源项目（openhr-founder-ai、hackmate、indexed-ideas 等）与中国市场同类产品（缘创派、爱合伙、程序员客栈、OPC 接单吧），落地了：

- **AI 匹配推荐**：规则评分（技能/城市/身份/年限）+ LLM 生成一句中文推荐理由；30 分钟缓存（`sf_recommendations`），失败自动降级为规则文案。
- **独立推荐页** `/recommendations`：6 条推荐、匹配度展示、手动刷新（`refresh=1`）。
- **详情页推荐理由**：推荐帖详情页显示「✨ AI 认为这条适合你」。
- **画像字段**：个人资料新增技能方向、经验年限，为匹配提供输入。

**2026-08-18 追加**

- **社区动态区** `/community`：动态发布/评论 + 帖子详情评论区；评论与动态写入时自动脱敏联系方式、每日频控、作者可删；新增 `sf_community_posts` / `sf_comments`。
- **首页双面价值入口**：资深专业人士 / 企业·投资人 两卡片可点击直达对应类型筛选；导航选中高亮 + lucide-react 图标；右上角显示登录账号（手机号/邮箱）；城市新增广州、西安。
- 首页与详情页数据库查询并行化，减少远程往返延迟。

## 6. 有意不做的取舍

| 项 | 原因 |
|----|------|
| 评论 | 2026-08-18 修订移入 v1.1 社区动态区（已实现）；“讨论最多”排序仍未做 |
| 暗色主题切换 | 产品定为亮色专业商务风 |
| Manus 登录、Google Maps | 外部集成需单独确认；城市级信息板用不上地图 |
| shadcn/ui 全套组件库 | marketplace 是演示原型；新应用保持轻量 Tailwind 组件 |
| 微信登录/实名、站内私信、支付、小程序/App | 明确 out of scope（v1） |
| Python/FastAPI | 当前规模 Next.js API + supabase-js 已覆盖；重计算需求出现时再独立接入 |

## 7. 技术栈与数据层要点

- Next.js 15（App Router）+ React 19 + Tailwind CSS 4；生产部署到阿里云 ECS/轻量。
- 数据库：Supabase 托管 PostgreSQL，表统一 `sf_` 前缀；迁移 SQL 在 `supabase/migrations/`，用 `supabase db query --linked` 应用。
- 数据访问：全部集中在 `src/lib/data.ts`（supabase-js + service_role）；路由不直接拼 REST。
- LLM：`OPENAI_COMPATIBLE_BASE_URL/API_KEY/MODEL`（DeepSeek），润色与匹配均带 10s 超时（`AI_REQUEST_TIMEOUT_MS`）与联系信息脱敏。
- 环境变量：`.env.local` 仅保留 Supabase keys、DeepSeek、短信、`ADMIN_PHONES`；`.env` / `.env.local` 均 gitignore。

## 8. 相关文件

- 首页与搜索：`src/app/page.tsx`、`src/components/SearchBox.tsx`、`SortSelect.tsx`、`FilterBar.tsx`
- 帖子：`src/components/PostCard.tsx`、`src/app/posts/[id]/page.tsx`
- AI 匹配：`src/lib/ai/match.ts`、`src/app/recommendations/page.tsx`、`src/app/api/recommendations/route.ts`
- 数据层：`src/lib/data.ts`、`src/lib/supabase.ts`、`src/lib/types.ts`
- 迁移：`supabase/migrations/20260812000000_supabase_sf_prefix.sql`、`20260812000010_sf_recommendations.sql`
- 种子：`scripts/seed.ts`
