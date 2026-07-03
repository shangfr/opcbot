import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  batchDeleteTickets,
  batchUpdateTicketPriority,
  batchUpdateTicketStatus,
  createTicket,
  createTicketCategory,
  deleteTicket,
  getTicketById,
  getTicketCategories,
  getTickets,
  getTicketsByUserId,
  getVisibleTickets,
  invalidateTicketCache,
  logTicketActivity,
  updateTicket,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { isValidStatusTransition } from "@/lib/ticket-status-machine";
import { isAdmin } from "@/lib/utils";

const ticketSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(128, "标题最长 128 个字符"),
  description: z
    .string()
    .min(1, "描述不能为空")
    .max(512, "描述最长 512 个字符"),
  content: z.string().max(4096, "详情最长 4096 个字符").nullable().default(null),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z
    .enum(["pending", "in_progress", "completed", "closed"])
    .default("pending"),
  progress: z.number().int().min(0).max(100).default(0),
  assignee: z.string().max(64, "负责人最长 64 个字符").nullable().default(null),
  phone: z.string().max(20, "手机号最长 20 个字符").nullable().default(null),
  dueDate: z.string().datetime().nullable().default(null),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  categoryId: z.string().uuid().nullable().default(null),
  visibility: z.enum(["public", "private"]).default("public"),
  // 🆕 AI 解析产出的结构化表单 Blob URL，存入 content 字段
  formSchemaUrl: z
    .string()
    .url()
    .optional()
    .describe("Vercel Blob 中结构化表单 JSON 的公开访问 URL"),
  // 🆕 AI 解析推断的类目名称，用于自动归类（当 categoryId 为空时按名称匹配/创建）
  autoCategoryName: z
    .string()
    .max(32)
    .optional()
    .describe("AI 推断的类目名称，用于自动分类匹配"),
});

/**
 * 自动分类匹配：根据类目名称查找或创建 TicketCategory
 * - 优先按名称匹配已有类目（不区分大小写）
 * - 未匹配到则创建新类目，归属当前用户
 * - 返回 categoryId（匹配/新建失败时返回 null）
 */
async function resolveCategoryIdByName(
  name: string | undefined,
  userId: string
): Promise<string | null> {
  if (!name || !name.trim()) return null;
  const trimmed = name.trim();

  try {
    const categories = await getTicketCategories();
    const matched = categories.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (matched) return matched.id;

    // 未匹配则创建新类目
    const created = await createTicketCategory({
      name: trimmed,
      color: "#6366f1",
      colorKey: "indigo",
      sortOrder: 0,
      userId,
    });
    return created.id;
  } catch (err) {
    console.error("[tickets] 自动分类失败:", err);
    return null;
  }
}

// 批量操作 schema
const batchSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "至少选择一个工单"),
  action: z.enum(["status", "priority", "delete"]),
  value: z.string().optional(), // status 或 priority 的新值
});

async function checkAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new ChatbotError("unauthorized:ticket");
  }
  return session;
}

/**
 * 检查用户是否有权操作指定工单
 * - 管理员：可操作所有 public 工单
 * - 普通用户：仅可操作自己创建的 private 工单
 */
async function checkTicketOwnership(ticketId: string, userId: string) {
  const existing = await getTicketById({ id: ticketId });
  if (!existing) {
    throw new ChatbotError("not_found:ticket");
  }

  const session = await auth();
  if (session?.user && isAdmin(session.user)) {
    return existing;
  }

  if (existing.userId !== userId || existing.visibility !== "private") {
    throw new ChatbotError("forbidden:ticket");
  }

  return existing;
}

/** CSV 转义 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  try {
    const session = await checkAuth();
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope"); // "mine" = 仅自己创建的
    const exportCsv = searchParams.get("export");

    let tickets;
    if (scope === "mine") {
      tickets = await getTicketsByUserId({ userId: session.user.id });
    } else if (isAdmin(session.user)) {
      tickets = await getTickets();
    } else {
      tickets = await getVisibleTickets({
        userId: session.user.id,
        userIsAdmin: false,
      });
    }

    // CSV 导出
    if (exportCsv === "csv") {
      const header = [
        "ID",
        "标题",
        "描述",
        "优先级",
        "状态",
        "进度",
        "负责人",
        "手机号",
        "截止日期",
        "可见性",
        "启用",
        "创建时间",
        "更新时间",
      ];
      const rows = tickets.map((t) =>
        [
          t.id,
          t.title,
          t.description,
          t.priority,
          t.status,
          t.progress,
          t.assignee ?? "",
          t.phone ?? "",
          t.dueDate ? new Date(t.dueDate).toISOString() : "",
          t.visibility,
          t.isActive ? "是" : "否",
          new Date(t.createdAt).toISOString(),
          new Date(t.updatedAt).toISOString(),
        ]
          .map(csvEscape)
          .join(",")
      );
      const csv = [header.map(csvEscape).join(","), ...rows].join("\n");
      return new Response("\uFEFF" + csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="tickets-${Date.now()}.csv"`,
        },
      });
    }

    return Response.json(tickets, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}

export async function POST(request: Request) {
  try {
    const session = await checkAuth();
    let body: z.infer<typeof ticketSchema>;

    try {
      body = ticketSchema.parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:ticket",
        "请求数据格式不正确。请检查后重试。"
      ).toResponse();
    }

    // 权限校验：普通用户只能创建 private 工单
    const userIsAdmin = isAdmin(session.user);
    const visibility = userIsAdmin ? body.visibility : "private";

    // 🆕 自动分类匹配：若未显式指定 categoryId，则按 AI 推断的类目名称匹配/创建
    let resolvedCategoryId = body.categoryId;
    if (!resolvedCategoryId && body.autoCategoryName) {
      resolvedCategoryId = await resolveCategoryIdByName(
        body.autoCategoryName,
        session.user.id
      );
    }

    // 🆕 将 formSchemaUrl 与原始 content 合并写入 content 字段
    // content 字段最多 4096 字符，存储 JSON 元信息（formSchemaUrl + 摘要）
    let finalContent = body.content;
    if (body.formSchemaUrl) {
      const meta = {
        formSchemaUrl: body.formSchemaUrl,
        autoCategoryName: body.autoCategoryName ?? null,
        content: body.content ?? "",
      };
      const metaStr = JSON.stringify(meta);
      // 若元信息超长则降级为仅存 URL
      finalContent = metaStr.length <= 4096 ? metaStr : body.formSchemaUrl;
    }

    const result = await createTicket({
      title: body.title,
      description: body.description,
      content: finalContent,
      priority: body.priority,
      status: body.status,
      progress: body.progress,
      assignee: body.assignee,
      phone: body.phone,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      categoryId: resolvedCategoryId,
      userId: session.user.id,
      visibility,
      isActive: body.isActive,
      sortOrder: body.sortOrder,
    });

    // 记录创建活动日志
    await logTicketActivity({
      ticketId: result.id,
      userId: session.user.id,
      type: "created",
      summary: "创建了工单",
      newValue: result.title,
    });

    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await checkAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new ChatbotError("bad_request:ticket", "缺少参数 id").toResponse();
    }

    let body: z.infer<typeof ticketSchema>;
    try {
      body = ticketSchema.parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:ticket",
        "请求数据格式不正确。请检查后重试。"
      ).toResponse();
    }

    const existing = await checkTicketOwnership(id, session.user.id);

    // 状态机校验：检查状态流转是否合法
    if (
      existing.status !== body.status &&
      !isValidStatusTransition(existing.status, body.status)
    ) {
      return new ChatbotError(
        "bad_request:ticket",
        `状态不能从「${existing.status}」直接变更为「${body.status}」`
      ).toResponse();
    }

    // 普通用户不能将 private 工单改为 public
    const userIsAdmin = isAdmin(session.user);
    const visibility = userIsAdmin ? body.visibility : existing.visibility;

    const result = await updateTicket({
      id,
      title: body.title,
      description: body.description,
      content: body.content,
      priority: body.priority,
      status: body.status,
      progress: body.progress,
      assignee: body.assignee,
      phone: body.phone,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      categoryId: body.categoryId,
      visibility,
      isActive: body.isActive,
      sortOrder: body.sortOrder,
    });

    invalidateTicketCache(id);

    // 记录字段变更活动日志
    if (existing.status !== body.status) {
      await logTicketActivity({
        ticketId: id,
        userId: session.user.id,
        type: "status_changed",
        summary: `状态变更: ${existing.status} → ${body.status}`,
        oldValue: existing.status,
        newValue: body.status,
      });
    }
    if (existing.priority !== body.priority) {
      await logTicketActivity({
        ticketId: id,
        userId: session.user.id,
        type: "priority_changed",
        summary: `优先级变更: ${existing.priority} → ${body.priority}`,
        oldValue: existing.priority,
        newValue: body.priority,
      });
    }
    if (existing.assignee !== body.assignee) {
      await logTicketActivity({
        ticketId: id,
        userId: session.user.id,
        type: "assignee_changed",
        summary: `负责人变更: ${existing.assignee ?? "无"} → ${body.assignee ?? "无"}`,
        oldValue: existing.assignee ?? "",
        newValue: body.assignee ?? "",
      });
    }

    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await checkAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const batch = searchParams.get("batch");

    // 批量删除
    if (batch === "1") {
      if (!isAdmin(session.user)) {
        return new ChatbotError("forbidden:ticket").toResponse();
      }
      let body: z.infer<typeof batchSchema>;
      try {
        body = batchSchema.parse(await request.json());
      } catch {
        return new ChatbotError(
          "bad_request:ticket",
          "批量操作请求数据格式不正确。"
        ).toResponse();
      }
      if (body.action !== "delete") {
        return new ChatbotError(
          "bad_request:ticket",
          "批量删除操作类型错误。"
        ).toResponse();
      }
      const results = await batchDeleteTickets({ ids: body.ids });
      for (const tid of body.ids) invalidateTicketCache(tid);
      return Response.json({ deleted: results.length }, { status: 200 });
    }

    if (!id) {
      return new ChatbotError("bad_request:ticket", "缺少参数 id").toResponse();
    }

    await checkTicketOwnership(id, session.user.id);

    // 记录删除活动日志（在删除前记录）
    await logTicketActivity({
      ticketId: id,
      userId: session.user.id,
      type: "deleted",
      summary: "删除了工单",
    });

    const result = await deleteTicket({ id });
    invalidateTicketCache(id);
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}

/** 批量更新（PUT 方法用于批量状态/优先级变更） */
export async function PUT(request: Request) {
  try {
    const session = await checkAuth();
    if (!isAdmin(session.user)) {
      return new ChatbotError("forbidden:ticket").toResponse();
    }

    let body: z.infer<typeof batchSchema>;
    try {
      body = batchSchema.parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:ticket",
        "批量操作请求数据格式不正确。"
      ).toResponse();
    }

    let results;
    if (body.action === "status" && body.value) {
      results = await batchUpdateTicketStatus({
        ids: body.ids,
        status: body.value as "pending" | "in_progress" | "completed" | "closed",
      });
    } else if (body.action === "priority" && body.value) {
      results = await batchUpdateTicketPriority({
        ids: body.ids,
        priority: body.value as "low" | "medium" | "high" | "urgent",
      });
    } else {
      return new ChatbotError(
        "bad_request:ticket",
        "批量操作参数不完整。"
      ).toResponse();
    }

    for (const tid of body.ids) invalidateTicketCache(tid);
    return Response.json({ updated: results.length }, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}
