import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { ChatbotError } from "@/lib/errors";
import { generateUUID } from "@/lib/utils";

const createChatSchema = z.object({
  agentId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof createChatSchema>;
  try {
    body = createChatSchema.parse(await request.json());
  } catch {
    return new ChatbotError("bad_request:api", "请求参数不正确").toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  // Only generate chatId, don't save to DB yet.
  // DB record is created when the first message is sent.
  const chatId = generateUUID();

  return Response.json({ chatId, agentId: body.agentId ?? null });
}
