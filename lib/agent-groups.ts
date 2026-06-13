/**
 * Agent 分组配色 —— 按 sortOrder 区间映射 7 个业务域
 *
 * sortOrder 范围：
 *   1-4   法律合规     Indigo / 靛青
 *   5-7   财税资本     Amber  / 琥珀
 *   10-12 核心战略     Emerald / 翡翠
 *   13-15 产业政策     Violet  / 紫罗兰
 *   20-22 AI与数字化   Sky     / 天青
 *   30-32 OPC孵化     Orange  / 橘橙
 *   40-42 三大平台     Rose    / 玫红
 *   其他  默认         Slate   / 石板灰
 */

export interface AgentGroup {
  key: string;
  label: string;
  /** Tailwind 背景色 class（头像底色） */
  bg: string;
  /** Tailwind 文字色 class（头像文字） */
  text: string;
  /** Tailwind 卡片左边框装饰色 */
  accent: string;
  /** Tailwind 浅底色（标签/徽章） */
  soft: string;
  /** Tailwind 浅文字色 */
  softText: string;
  /** Tailwind 卡片 hover 边框色 */
  ring: string;
  /** 渐变起始色（用于 bg-gradient-to-br from-{color}/[0.04]） */
  gradientFrom: string;
  /** hover 边框色 class */
  borderHover: string;
  /** hover 彩色阴影（完整 class） */
  hoverShadow: string;
  /** 排序权重 */
  order: number;
}

const GROUPS: AgentGroup[] = [
  {
    key: "legal",
    label: "法律合规",
    bg: "bg-indigo-500",
    text: "text-white",
    accent: "border-l-indigo-400",
    soft: "bg-indigo-50 dark:bg-indigo-950/40",
    softText: "text-indigo-700 dark:text-indigo-300",
    ring: "ring-indigo-500/20",
    gradientFrom: "bg-indigo-500/[0.04]",
    borderHover: "border-indigo-500/25",
    hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(99,102,241,0.15)]",
    order: 1,
  },
  {
    key: "finance",
    label: "财税资本",
    bg: "bg-amber-500",
    text: "text-white",
    accent: "border-l-amber-400",
    soft: "bg-amber-50 dark:bg-amber-950/40",
    softText: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-500/20",
    gradientFrom: "bg-amber-500/[0.04]",
    borderHover: "border-amber-500/25",
    hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(245,158,11,0.15)]",
    order: 2,
  },
  {
    key: "strategy",
    label: "核心战略",
    bg: "bg-emerald-500",
    text: "text-white",
    accent: "border-l-emerald-400",
    soft: "bg-emerald-50 dark:bg-emerald-950/40",
    softText: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-500/20",
    gradientFrom: "bg-emerald-500/[0.04]",
    borderHover: "border-emerald-500/25",
    hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(16,185,129,0.15)]",
    order: 3,
  },
  {
    key: "policy",
    label: "产业政策",
    bg: "bg-violet-500",
    text: "text-white",
    accent: "border-l-violet-400",
    soft: "bg-violet-50 dark:bg-violet-950/40",
    softText: "text-violet-700 dark:text-violet-300",
    ring: "ring-violet-500/20",
    gradientFrom: "bg-violet-500/[0.04]",
    borderHover: "border-violet-500/25",
    hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(139,92,246,0.15)]",
    order: 4,
  },
  {
    key: "ai",
    label: "AI与数字化",
    bg: "bg-sky-500",
    text: "text-white",
    accent: "border-l-sky-400",
    soft: "bg-sky-50 dark:bg-sky-950/40",
    softText: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-500/20",
    gradientFrom: "bg-sky-500/[0.04]",
    borderHover: "border-sky-500/25",
    hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(14,165,233,0.15)]",
    order: 5,
  },
  {
    key: "opc",
    label: "OPC孵化",
    bg: "bg-orange-500",
    text: "text-white",
    accent: "border-l-orange-400",
    soft: "bg-orange-50 dark:bg-orange-950/40",
    softText: "text-orange-700 dark:text-orange-300",
    ring: "ring-orange-500/20",
    gradientFrom: "bg-orange-500/[0.04]",
    borderHover: "border-orange-500/25",
    hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(249,115,22,0.15)]",
    order: 6,
  },
  {
    key: "platform",
    label: "三大平台",
    bg: "bg-rose-500",
    text: "text-white",
    accent: "border-l-rose-400",
    soft: "bg-rose-50 dark:bg-rose-950/40",
    softText: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-500/20",
    gradientFrom: "bg-rose-500/[0.04]",
    borderHover: "border-rose-500/25",
    hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(244,63,94,0.15)]",
    order: 0,
  },
];

const DEFAULT_GROUP: AgentGroup = {
  key: "default",
  label: "通用",
  bg: "bg-slate-500",
  text: "text-white",
  accent: "border-l-slate-400",
  soft: "bg-slate-50 dark:bg-slate-950/40",
  softText: "text-slate-700 dark:text-slate-300",
  ring: "ring-slate-500/20",
  gradientFrom: "bg-slate-500/[0.04]",
  borderHover: "border-slate-500/25",
  hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(100,116,139,0.15)]",
  order: 99,
};

/** 根据 sortOrder 判断所属分组 */
export function getAgentGroup(sortOrder: number): AgentGroup {
  if (sortOrder >= 1 && sortOrder <= 4) return GROUPS[0];  // 法律合规
  if (sortOrder >= 5 && sortOrder <= 7) return GROUPS[1];  // 财税资本
  if (sortOrder >= 10 && sortOrder <= 12) return GROUPS[2]; // 核心战略
  if (sortOrder >= 13 && sortOrder <= 15) return GROUPS[3]; // 产业政策
  if (sortOrder >= 20 && sortOrder <= 22) return GROUPS[4]; // AI与数字化
  if (sortOrder >= 30 && sortOrder <= 32) return GROUPS[5]; // OPC孵化
  if (sortOrder >= 40 && sortOrder <= 42) return GROUPS[6]; // 三大平台
  return DEFAULT_GROUP;
}

/** 取名字的首个汉字或大写字母作为头像文字 */
export function getAvatarChar(name: string): string {
  const hanMatch = name.match(/[\u4e00-\u9fff]/);
  if (hanMatch) return hanMatch[0];
  const upperMatch = name.match(/[A-Z]/);
  if (upperMatch) return upperMatch[0];
  return name.charAt(0).toUpperCase() || "?";
}

/** 所有分组（按 order 排序），用于渲染分组标题 */
export function getAllGroups(): AgentGroup[] {
  return [...GROUPS].sort((a, b) => a.order - b.order);
}
