/**
 * UI 设计 Token 常量
 *
 * 集中管理交互目标尺寸、间距、动画时长等设计约束，
 * 避免散落在各组件中的魔法数字，便于统一调整与无障碍合规。
 */

/** 触控目标最小尺寸（WCAG 2.5.5 推荐 ≥44×44 CSS 像素） */
export const TOUCH_TARGET = {
  /** 最小触控目标边长（px） */
  min: 44,
  /** 紧凑场景下的最小边长（px），用于工具栏图标按钮 */
  compact: 36,
} as const;

/** 通用动画时长（毫秒） */
export const DURATION = {
  fast: 150,
  base: 200,
  slow: 300,
} as const;

/** 通用缓动函数 */
export const EASING = {
  /** 标准缓出，用于进入动画 */
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** 缓入缓出，用于状态切换 */
  inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

/** 滚动条相关样式 token */
export const SCROLLBAR = {
  /** 自定义滚动条宽度（px） */
  width: 6,
  /** 悬停时滚动条宽度（px） */
  hoverWidth: 8,
} as const;

/** 消息列表相关 token */
export const MESSAGE = {
  /** 消息操作按钮在触屏设备上的最小触控尺寸 */
  actionTarget: 36,
  /** 骨架屏动画时长（毫秒） */
  skeletonDuration: 1200,
} as const;

/** 侧边栏相关 token */
export const SIDEBAR = {
  /** 历史项最小高度（px） */
  itemMinHeight: 44,
  /** 折叠态宽度（px） */
  collapsedWidth: 0,
  /** 展开态宽度（px） */
  expandedWidth: 260,
} as const;
