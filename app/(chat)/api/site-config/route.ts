import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  getSiteConfig,
  upsertSiteConfig,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { isAdmin } from "@/lib/utils";

const siteConfigSchema = z.object({
  defaultSystemPrompt: z.string().nullable().default(null),
  defaultStarterQuestions: z.array(z.string()).max(8).nullable().default(null),
  siteName: z.string().max(64).nullable().default(null),
  siteDescription: z.string().max(512).nullable().default(null),
});

async function checkAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new ChatbotError("unauthorized:site-config");
  }
  return session;
}

async function checkAdmin() {
  const session = await checkAuth();
  if (!isAdmin(session.user)) {
    throw new ChatbotError("forbidden:site-config");
  }
  return session;
}

export async function GET() {
  try {
    const session = await checkAuth();
    const config = await getSiteConfig();
    return Response.json(config, {
      status: 200,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    });
  } catch (err) {
    if (err instanceof ChatbotError) {
      return err.toResponse();
    }
    return new ChatbotError("bad_request:site-config").toResponse();
  }
}

export async function PATCH(request: Request) {
  try {
    await checkAdmin();

    let body: z.infer<typeof siteConfigSchema>;
    try {
      body = siteConfigSchema.parse(await request.json());
    } catch (err) {
      console.error("SiteConfig PATCH validation error:", err);
      return new ChatbotError(
        "bad_request:site-config",
        "请求数据格式不正确。"
      ).toResponse();
    }

    console.log("Saving site config:", body);
    const result = await upsertSiteConfig({
      defaultSystemPrompt: body.defaultSystemPrompt,
      defaultStarterQuestions: body.defaultStarterQuestions,
      siteName: body.siteName,
      siteDescription: body.siteDescription,
    });

    return Response.json(result, { status: 200 });
  } catch (err) {
    console.error("SiteConfig PATCH error:", err);
    if (err instanceof ChatbotError) {
      return err.toResponse();
    }
    return new ChatbotError("bad_request:site-config").toResponse();
  }
}
