/**
 * 幂等种子脚本：写入两个演示用户与 14 条演示帖子。
 * 运行：npm run seed
 * 读取 .env.local 中的 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY。
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return {};
  const result: Record<string, string> = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    result[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
  return result;
}

const env = { ...loadEnvFile(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

const users = [
  {
    phone: "13900000001",
    nickname: "林舟",
    city: "上海",
    role_tag: "founder",
    bio: "连续创业者，关注 AI 应用与企业服务。",
    skills: ["AI大模型", "SaaS", "供应链"],
    years_experience: 15,
    is_verified: true,
  },
  {
    phone: "13900000002",
    nickname: "陈曦",
    city: "深圳",
    role_tag: "talent",
    bio: "全栈产品工程师，偏好从 0 到 1 的小团队。",
    skills: ["全栈", "React", "Node.js", "PostgreSQL"],
    years_experience: 12,
    is_verified: true,
  },
];

type SeedPost = {
  id: string;
  authorPhone: string;
  type: "partner" | "talent" | "project" | "funding";
  title: string;
  city: string;
  tags: string[];
  body_json: Record<string, unknown>;
};

const posts: SeedPost[] = [
  {
    id: "seed-post-01",
    authorPhone: users[0].phone,
    type: "partner",
    title: "寻找懂供应链的 AI 产品技术合伙人",
    city: "上海",
    tags: ["AI大模型", "SaaS", "股权合伙"],
    body_json: {
      projectStage: "已有 12 家付费试点客户，正在打磨标准版 MVP",
      intro:
        "面向中小制造企业做采购与库存智能助手，把询价、比价和补货建议整合到一个工作台。",
      techNeeds:
        "希望你熟悉 TypeScript、LLM 应用和多租户 SaaS，能主导产品技术路线并参与客户访谈。",
      cooperationModes: ["股权合伙", "全职加入"],
      equitySalary: "可谈联合创始人期权，融资后提供市场薪资",
      currentTeam: "创始人负责行业与销售，另有一名供应链顾问",
    },
  },
  {
    id: "seed-post-02",
    authorPhone: users[1].phone,
    type: "partner",
    title: "跨境电商 Agent 项目寻找增长合伙人",
    city: "深圳",
    tags: ["Agent", "出海", "股权合伙"],
    body_json: {
      projectStage: "内测版已上线，完成首批 30 个店铺数据接入",
      intro:
        "为独立站和跨境卖家自动完成竞品追踪、素材策划与投放复盘，目标市场为东南亚。",
      techNeeds: "寻找有跨境渠道或增长经验的伙伴，共同验证获客模型和商业化路径。",
      cooperationModes: ["股权合伙", "兼职合作"],
      equitySalary: "早期以股权为主，可按阶段目标转全职",
      currentTeam: "两名全栈工程师和一名设计师",
    },
  },
  {
    id: "seed-post-03",
    authorPhone: users[0].phone,
    type: "partner",
    title: "成都银发健康 SaaS 寻运营合伙人",
    city: "成都",
    tags: ["SaaS", "35+优先", "股权合伙"],
    body_json: {
      projectStage: "完成社区试点方案，准备启动首个街道样板",
      intro:
        "帮助社区养老服务站管理随访、课程和家属沟通，先从线下服务数字化切入。",
      techNeeds: "需要有社区、养老或医疗服务运营经验，能建立标准流程并带领一线团队。",
      cooperationModes: ["股权合伙", "全职加入"],
      equitySalary: "基础薪资加项目分红，股权面议",
      currentTeam: "产品负责人、行业顾问和外包研发团队",
    },
  },
  {
    id: "seed-post-04",
    authorPhone: users[1].phone,
    type: "partner",
    title: "远程协作：教育内容工具寻找联合创始人",
    city: "远程",
    tags: ["AI大模型", "SaaS", "全栈"],
    body_json: {
      projectStage: "原型完成，正在与职业教育机构共创",
      intro:
        "把课程资料快速整理成讲义、练习和知识卡片，减少教研团队的重复劳动。",
      techNeeds: "希望伙伴兼具产品判断和工程能力，愿意每周稳定投入并共同跑通 PMF。",
      cooperationModes: ["兼职合作", "股权合伙"],
      equitySalary: "验证收入前以股权为主，成本按实报销",
      currentTeam: "发起人有十年职业教育产品经验",
    },
  },
  {
    id: "seed-post-05",
    authorPhone: users[1].phone,
    type: "talent",
    title: "8 年全栈工程师，寻找 AI SaaS 创业团队",
    city: "杭州",
    tags: ["全栈", "AI大模型", "SaaS"],
    body_json: {
      status: "在职，确认方向后可于一个月内全职加入",
      background:
        "做过电商中台和企业协同产品，熟悉 React、Node.js、PostgreSQL 与云上部署，带过 6 人研发小组。",
      timeCommitment: "目前每周可投入 15 小时",
      desiredModes: ["股权合伙", "全职加入"],
      portfolio: "可在沟通后提供脱敏项目案例",
    },
  },
  {
    id: "seed-post-06",
    authorPhone: users[0].phone,
    type: "talent",
    title: "前大厂推荐算法负责人，关注产业 AI 落地",
    city: "北京",
    tags: ["AI大模型", "架构师", "35+优先"],
    body_json: {
      status: "自由顾问，寻找值得长期投入的业务",
      background:
        "十二年算法与平台经验，负责过推荐系统、特征平台和大模型评测，擅长把研究能力转成稳定产品。",
      timeCommitment: "前期每周 2 至 3 天，匹配后可全职",
      desiredModes: ["股权合伙", "项目制"],
      portfolio: "公开分享与专利清单可私下发送",
    },
  },
  {
    id: "seed-post-07",
    authorPhone: users[1].phone,
    type: "talent",
    title: "出海产品经理，擅长从 0 到 1 验证",
    city: "深圳",
    tags: ["出海", "SaaS", "Agent"],
    body_json: {
      status: "可立即开始远程合作",
      background:
        "负责过面向欧美市场的订阅工具，覆盖用户研究、定价、增长实验和本地化，熟悉英文商务沟通。",
      timeCommitment: "每周可投入 20 小时",
      desiredModes: ["兼职合作", "股权合伙"],
      portfolio: "可提供产品数据复盘和英文方案样例",
    },
  },
  {
    id: "seed-post-08",
    authorPhone: users[0].phone,
    type: "talent",
    title: "B 端销售负责人，寻找技术驱动型项目",
    city: "上海",
    tags: ["SaaS", "35+优先", "股权合伙"],
    body_json: {
      status: "正在筛选联合创业机会",
      background:
        "深耕制造与零售行业十年，做过从首单到千万级年合同额的销售体系，能承担早期客户开发。",
      timeCommitment: "每周可投入 3 天，达成共识后全职",
      desiredModes: ["股权合伙", "全职加入"],
      portfolio: "客户案例需签署保密协议后沟通",
    },
  },
  {
    id: "seed-post-09",
    authorPhone: users[0].phone,
    type: "project",
    title: "招聘面试助手 MVP 寻全栈开发",
    city: "北京",
    tags: ["AI大模型", "全栈", "SaaS"],
    body_json: {
      projectKind: "Web SaaS MVP",
      techNeeds:
        "根据岗位描述生成结构化面试题，支持录音转写、要点总结和候选人对比；需完成账号、套餐和管理后台。",
      workMode: "远程项目制，每周两次同步",
      budget: "6 万至 9 万元",
      duration: "6 至 8 周",
    },
  },
  {
    id: "seed-post-10",
    authorPhone: users[1].phone,
    type: "project",
    title: "连锁门店数据看板二期开发",
    city: "杭州",
    tags: ["SaaS", "全栈", "架构师"],
    body_json: {
      projectKind: "企业内部数据平台",
      techNeeds:
        "对接现有 ERP 和会员系统，补充门店经营指标、权限体系及日报订阅，要求有数据同步与性能优化经验。",
      workMode: "杭州可现场沟通，开发可远程",
      budget: "10 万至 15 万元",
      duration: "约 10 周",
    },
  },
  {
    id: "seed-post-11",
    authorPhone: users[0].phone,
    type: "project",
    title: "海外客服知识库 Agent 概念验证",
    city: "远程",
    tags: ["Agent", "出海", "AI大模型"],
    body_json: {
      projectKind: "企业 AI PoC",
      techNeeds:
        "基于英文产品文档搭建 RAG 问答，接入现有客服工单系统，并提供引用溯源、反馈收集和基础评测。",
      workMode: "全程远程，按里程碑验收",
      budget: "4 万至 6 万元",
      duration: "4 周",
    },
  },
  {
    id: "seed-post-12",
    authorPhone: users[1].phone,
    type: "funding",
    title: "工业质检 AI 项目寻天使轮投资",
    city: "深圳",
    tags: ["AI大模型", "SaaS", "架构师"],
    body_json: {
      stage: "天使轮",
      amount: "计划融资 500 万元",
      intro:
        "为 3C 零部件工厂提供小样本视觉质检方案，已在两条产线稳定运行并签下年度服务合同。",
      team: "核心成员来自工业自动化、计算机视觉和制造业销售团队。",
      equity: "本轮拟出让 10% 至 12%",
    },
  },
  {
    id: "seed-post-13",
    authorPhone: users[0].phone,
    type: "funding",
    title: "宠物健康管理平台启动种子轮",
    city: "上海",
    tags: ["SaaS", "AI大模型", "出海"],
    body_json: {
      stage: "种子轮",
      amount: "计划融资 300 万元",
      intro:
        "连接宠物医院与主人，提供健康档案、复诊提醒和智能问诊前信息采集，已有 20 家门店试用。",
      team: "联合创始人分别有连锁宠物医疗、消费产品和 SaaS 研发经验。",
      equity: "可根据资源与投资额协商",
    },
  },
  {
    id: "seed-post-14",
    authorPhone: users[1].phone,
    type: "funding",
    title: "县域文旅数字化项目寻产业投资",
    city: "成都",
    tags: ["SaaS", "35+优先", "出海"],
    body_json: {
      stage: "Pre-A 轮",
      amount: "计划融资 1200 万元",
      intro:
        "为县域景区和文旅集团提供内容运营、票务分销与游客数据平台，已服务西南地区 8 个目的地。",
      team: "团队 15 人，核心成员来自在线旅游平台和地方文旅集团。",
      equity: "本轮拟出让不超过 15%",
    },
  },
];

async function main() {
  const userIds = new Map<string, string>();

  for (const user of users) {
    const { data: existing } = await supabase
      .from("sf_users")
      .select("id")
      .eq("phone", user.phone)
      .maybeSingle();
    let id = existing?.id;
    if (id) {
      await supabase.from("sf_users").update(user).eq("id", id);
    } else {
      const { data, error } = await supabase
        .from("sf_users")
        .insert(user)
        .select("id")
        .single();
      if (error || !data) throw new Error(`创建用户失败: ${user.phone}`);
      id = data.id;
    }
    userIds.set(user.phone, id);
  }

  for (const post of posts) {
    const authorId = userIds.get(post.authorPhone);
    if (!authorId) throw new Error(`缺少作者: ${post.authorPhone}`);
    const row = {
      ...post,
      author_id: authorId,
      contact_private: "wx_seed_demo",
      status: "active",
    };
    delete (row as { authorPhone?: string }).authorPhone;
    const { data: existing } = await supabase
      .from("sf_posts")
      .select("id")
      .eq("id", post.id)
      .maybeSingle();
    if (existing) {
      await supabase.from("sf_posts").update(row).eq("id", post.id);
    } else {
      const { error } = await supabase.from("sf_posts").insert(row);
      if (error) throw new Error(`创建帖子失败: ${post.id} (${error.message})`);
    }
  }

  console.log(`Seeded ${users.length} users and ${posts.length} posts.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await supabase.auth.signOut();
  });
