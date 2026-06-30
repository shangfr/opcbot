import { auth } from "@/app/(auth)/auth";
import {
  createTicketComment,
  getTicketComments,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

const commentSchema = {
  validate(body: unknown): { content: string } | null {
    if (
      typeof body === "object" &&
      body !== null &&
      "content" in body &&
      typeof (body as { content: unknown }).content === "string"
    ) {
      const content = (body as { content: string }).content.trim();
      if (content.length === 0 || content.length > 2000) return null;
      return { content };
    }
    return null;
  },
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new ChatbotError("unauthorized:ticket");
    }
    const { id } = await params;
    const comments = await getTicketComments({ ticketId: id });
    return Response.json(comments, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new ChatbotError("unauthorized:ticket");
    }
    const { id } = await params;
    const parsed = commentSchema.validate(await request.json());
    if (!parsed) {
      return new ChatbotError(
        "bad_request:ticket",
        "评论内容不能为空且不超过 2000 字。"
      ).toResponse();
    }
    const result = await createTicketComment({
      ticketId: id,
      userId: session.user.id,
      content: parsed.content,
    });
    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}
