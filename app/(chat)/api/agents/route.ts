import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createAgent,
  deleteAgent,
  getAgentById,
  getAgents,
  getAgentsByUserId,
  getVisibleAgents,
  invalidateAgentCache,
  updateAgent,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { isAdmin } from "@/lib/utils";

const agentSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(64, "名称最长 64 个字符"),
  description: z
    .string()
    .min(1, "描述不能为空")
    .max(512, "描述最长 512 个字符"),
  avatar: z.string().default("/icon.png"),
  systemPrompt: z.string().min(1, "系统提示词不能为空"),
  phone: z.string().max(20, "手机号最长 20 个字符").nullable().default(null),
  knowledgeId: z
    .string()
    .max(64, "知识库 ID 最长 64 个字符")
    .nullable()
    .default(null),
  starterQuestions: z.array(z.string()).max(8, "默认问题最多 8 个").default([]),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  categoryId: z.string().uuid().nullable().default(null),
  // 可见性：public=全站可见（仅管理员可创建），private=仅创建者可见（普通用户可创建）
  visibility: z.enum(["public", "private"]).default("public"),
});

async function checkAuth() {
  const session = await auth();

  if (!session?.user) {
    throw new ChatbotError("unauthorized:agent");
  }

  return session;
}

async function checkAdmin() {
  const session = await checkAuth();

  if (!isAdmin(session.user)) {
    throw new ChatbotError("forbidden:agent");
  }

  return session;
}

/**
 * 检查用户是否有权操作指定 Agent
 * - 管理员：可操作所有 Agent
 * - 普通用户：仅可操作自己创建的 private Agent
 */
async function checkAgentOwnership(agentId: string, userId: string) {
  const existing = await getAgentById({ id: agentId });
  if (!existing) {
    throw new ChatbotError("not_found:agent");
  }

  // 管理员可操作所有
  const session = await auth();
  if (session?.user && isAdmin(session.user)) {
    return existing;
  }

  // 普通用户仅可操作自己创建的 private Agent
  if (existing.userId !== userId || existing.visibility !== "private") {
    throw new ChatbotError("forbidden:agent");
  }

  return existing;
}

export async function GET(request: Request) {
  try {
    const session = await checkAuth();
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope"); // "mine" = 仅自己创建的

    // 普通用户：返回公共 OPC + 自己的 private OPC
    // 管理员：返回所有 OPC
    let agents;
    if (scope === "mine") {
      agents = await getAgentsByUserId({ userId: session.user.id });
    } else if (isAdmin(session.user)) {
      agents = await getAgents();
    } else {
      agents = await getVisibleAgents({ userId: session.user.id });
    }

    return Response.json(agents, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) {
      return err.toResponse();
    }
    return new ChatbotError("bad_request:agent").toResponse();
  }
}

export async function POST(request: Request) {
  try {
    const session = await checkAuth();

    let body: z.infer<typeof agentSchema>;
    try {
      body = agentSchema.parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:agent",
        "请求数据格式不正确。请检查后重试。"
      ).toResponse();
    }

    // 权限校验：普通用户只能创建 private OPC，不能创建 public OPC
    const userIsAdmin = isAdmin(session.user);
    const visibility = userIsAdmin ? body.visibility : "private";

    // 普通用户不能设置 isDefault
    const isDefault = userIsAdmin ? body.isDefault : false;

    const result = await createAgent({
      name: body.name,
      description: body.description,
      avatar: body.avatar,
      systemPrompt: body.systemPrompt,
      phone: body.phone,
      knowledgeId: body.knowledgeId,
      starterQuestions: body.starterQuestions,
      isActive: body.isActive,
      isDefault,
      sortOrder: body.sortOrder,
      categoryId: body.categoryId,
      userId: session.user.id,
      visibility,
    });

    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ChatbotError) {
      return err.toResponse();
    }
    return new ChatbotError("bad_request:agent").toResponse();
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await checkAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new ChatbotError("bad_request:agent", "缺少参数 id").toResponse();
    }

    // 检查所有权
    const existing = await checkAgentOwnership(id, session.user.id);

    let body: Partial<z.infer<typeof agentSchema>>;
    try {
      body = await request.json();
    } catch {
      return new ChatbotError(
        "bad_request:agent",
        "请求数据格式不正确"
      ).toResponse();
    }

    // 普通用户不能修改 visibility 和 isDefault
    const userIsAdmin = isAdmin(session.user);
    if (!userIsAdmin) {
      delete body.visibility;
      delete body.isDefault;
    }

    const result = await updateAgent({
      id,
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      avatar: body.avatar ?? existing.avatar,
      systemPrompt: body.systemPrompt ?? existing.systemPrompt,
      phone: body.phone !== undefined ? body.phone : existing.phone,
      knowledgeId:
        body.knowledgeId !== undefined ? body.knowledgeId : existing.knowledgeId,
      starterQuestions:
        body.starterQuestions ?? existing.starterQuestions ?? [],
      isActive: body.isActive ?? existing.isActive,
      isDefault: body.isDefault,
      sortOrder: body.sortOrder ?? existing.sortOrder,
      categoryId:
        body.categoryId !== undefined ? body.categoryId : existing.categoryId,
      visibility: body.visibility ?? existing.visibility,
    });

    invalidateAgentCache(id);
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) {
      return err.toResponse();
    }
    return new ChatbotError("bad_request:agent").toResponse();
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await checkAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new ChatbotError("bad_request:agent", "缺少参数 id").toResponse();
    }

    // 检查所有权
    await checkAgentOwnership(id, session.user.id);

    const result = await deleteAgent({ id });
    invalidateAgentCache(id);
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) {
      return err.toResponse();
    }
    return new ChatbotError("bad_request:agent").toResponse();
  }
}
