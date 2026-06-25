import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeBaseDetail,
  getKnowledgeUsage,
  listKnowledgeBases,
} from "@/lib/ai/zhipu-knowledge";
import { ChatbotError } from "@/lib/errors";
import { isAdmin } from "@/lib/utils";

const createSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(64, "名称最长 64 个字符"),
  embeddingId: z.number().int().optional(), // 3=Embedding-2, 11=Embedding-3, 12=Embedding-3-pro
  description: z.string().max(256).optional(),
});

async function checkAdmin() {
  const session = await auth();
  if (!session?.user) {
    throw new ChatbotError("unauthorized:agent");
  }
  if (!isAdmin(session.user)) {
    throw new ChatbotError("forbidden:agent");
  }
  return session;
}

/**
 * GET /api/knowledge — 列出所有知识库
 * GET /api/knowledge?id=xxx — 获取单个知识库详情（实时统计）
 */
export async function GET(request: Request) {
  try {
    await checkAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    // Single KB detail (real-time stats)
    if (id) {
      const result = await getKnowledgeBaseDetail(id);
      if (result.code !== 200) {
        return Response.json(
          { error: result.message },
          { status: 502 }
        );
      }
      return Response.json(result.data, { status: 200 });
    }

    // List all + usage info
    const [result, usageResult] = await Promise.all([
      listKnowledgeBases(1, 100),
      getKnowledgeUsage(),
    ]);

    if (result.code !== 200) {
      return Response.json(
        { error: result.message },
        { status: 502 }
      );
    }

    return Response.json(
      {
        ...result.data,
        usage: usageResult.code === 200 ? usageResult.data : null,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    console.error("[knowledge] list error:", err);
    return new ChatbotError("bad_request:api").toResponse();
  }
}

/**
 * POST /api/knowledge — 创建知识库
 */
export async function POST(request: Request) {
  try {
    await checkAdmin();

    let body: z.infer<typeof createSchema>;
    try {
      body = createSchema.parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:api",
        "请求数据格式不正确"
      ).toResponse();
    }

    const result = await createKnowledgeBase({
      name: body.name,
      embedding_id: body.embeddingId,
      description: body.description,
    });

    if (result.code !== 200) {
      return Response.json(
        { error: result.message },
        { status: 502 }
      );
    }

    return Response.json(result.data, { status: 201 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    console.error("[knowledge] create error:", err);
    return new ChatbotError("bad_request:api").toResponse();
  }
}

/**
 * DELETE /api/knowledge?id=xxx — 删除知识库
 */
export async function DELETE(request: Request) {
  try {
    await checkAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new ChatbotError("bad_request:api", "缺少参数 id").toResponse();
    }

    const result = await deleteKnowledgeBase(id);

    if (result.code !== 200) {
      return Response.json(
        { error: result.message },
        { status: 502 }
      );
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    console.error("[knowledge] delete error:", err);
    return new ChatbotError("bad_request:api").toResponse();
  }
}
