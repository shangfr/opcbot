/**
 * 路由标题常量
 *
 * 集中管理各路由页面的标题文案，避免散落在组件中的硬编码字符串，
 * 便于国际化与统一维护。
 */

export const ROUTE_TITLES = {
  chat: "AI 助手",
  agents: "智能体",
  agentsMarket: "智能体市场",
  agentDetail: "智能体详情",
  agentCreate: "创建智能体",
  agentEdit: "编辑智能体",
  login: "登录",
  register: "注册",
  profile: "个人中心",
  settings: "设置",
  docs: "文档",
} as const;

export type RouteTitleKey = keyof typeof ROUTE_TITLES;

/**
 * 根据路径获取标题，未匹配时回退到默认标题。
 */
export function getRouteTitle(
  pathname: string,
  fallback = ROUTE_TITLES.chat
): string {
  // 精确匹配优先
  if (pathname === "/" || pathname === "/chat") {
    return ROUTE_TITLES.chat;
  }
  if (pathname === "/login") {
    return ROUTE_TITLES.login;
  }
  if (pathname === "/register") {
    return ROUTE_TITLES.register;
  }
  if (pathname === "/profile") {
    return ROUTE_TITLES.profile;
  }
  if (pathname === "/settings") {
    return ROUTE_TITLES.settings;
  }
  if (pathname === "/docs") {
    return ROUTE_TITLES.docs;
  }

  // 前缀匹配
  if (pathname.startsWith("/agents/market")) {
    return ROUTE_TITLES.agentsMarket;
  }
  if (pathname.startsWith("/agents/create")) {
    return ROUTE_TITLES.agentCreate;
  }
  if (pathname.startsWith("/agents/") && pathname.includes("/edit")) {
    return ROUTE_TITLES.agentEdit;
  }
  if (pathname.startsWith("/agents/")) {
    return ROUTE_TITLES.agentDetail;
  }
  if (pathname.startsWith("/agents")) {
    return ROUTE_TITLES.agents;
  }

  return fallback;
}
