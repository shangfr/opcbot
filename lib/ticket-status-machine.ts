/**
 * 工单状态机配置
 *
 * 定义合法的状态流转路径，防止非法跳转（如从"已完成"直接跳回"待处理"）。
 * 产品角度：规范工单生命周期，避免状态混乱。
 */

export type TicketStatus = "pending" | "in_progress" | "completed" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

/**
 * 合法的状态流转映射
 * key = 当前状态，value = 可流转到的目标状态列表
 */
export const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  pending: ["in_progress", "completed", "closed"],
  in_progress: ["pending", "completed", "closed"],
  completed: ["in_progress", "closed"],
  closed: ["pending"], // 已关闭的工单可重新打开为待处理
};

/**
 * 检查状态流转是否合法
 */
export function isValidStatusTransition(
  from: TicketStatus,
  to: TicketStatus
): boolean {
  if (from === to) return true; // 相同状态允许（无变更）
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * 获取某状态的下一个合法状态列表（用于前端下拉选项过滤）
 */
export function getNextStatuses(current: TicketStatus): TicketStatus[] {
  return STATUS_TRANSITIONS[current] ?? [];
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  pending: "待处理",
  in_progress: "进行中",
  completed: "已完成",
  closed: "已关闭",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};
