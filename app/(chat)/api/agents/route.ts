import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createAgent,
  deleteAgent,
  getAgentById,
  getAgents,
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

export async function GET() {
  try {
    await checkAuth();
    const agents = await getAgents();
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
    const session = await checkAdmin();

    let body: z.infer<typeof agentSchema>;
    try {
      body = agentSchema.parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:agent",
        "请求数据格式不正确。请检查后重试。"
      ).toResponse();
    }

    const result = await createAgent({
      name: body.name,
      description: body.description,
      avatar: body.avatar,
      systemPrompt: body.systemPrompt,
      phone: body.phone,
      knowledgeId: body.knowledgeId,
      starterQuestions: body.starterQuestions,
      isActive: body.isActive,
      isDefault: body.isDefault,
      sortOrder: body.sortOrder,
      categoryId: body.categoryId,
      userId: session.user.id,
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
    await checkAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new ChatbotError("bad_request:agent", "缺少参数 id").toResponse();
    }

    const existing = await getAgentById({ id });
    if (!existing) {
      return new ChatbotError("not_found:agent").toResponse();
    }

    let body: Partial<z.infer<typeof agentSchema>>;
    try {
      body = agentSchema.partial().parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:agent",
        "请求数据格式不正确。"
      ).toResponse();
    }

    const result = await updateAgent({
      id,
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      avatar: body.avatar ?? existing.avatar,
      systemPrompt: body.systemPrompt ?? existing.systemPrompt,
      phone: body.phone ?? existing.phone,
      knowledgeId:
        body.knowledgeId !== undefined
          ? body.knowledgeId
          : existing.knowledgeId,
      starterQuestions:
        body.starterQuestions ?? existing.starterQuestions ?? [],
      isActive: body.isActive ?? existing.isActive,
      isDefault: body.isDefault,
      sortOrder: body.sortOrder ?? existing.sortOrder,
      categoryId:
        body.categoryId !== undefined ? body.categoryId : existing.categoryId,
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
    await checkAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new ChatbotError("bad_request:agent", "缺少参数 id").toResponse();
    }

    const existing = await getAgentById({ id });
    if (!existing) {
      return new ChatbotError("not_found:agent").toResponse();
    }

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
