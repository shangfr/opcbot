// app/(chat)/api/chat/route.ts
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
} from "ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import {
  allowedModelIds,
  chatModels,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
} from "@/lib/ai/models";
import { infrastructurePrompt, type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { withRetry } from "@/lib/ai/retry";
import { retrieve as retrieveKnowledge } from "@/lib/ai/zhipu-knowledge";
import { createDocument } from "@/lib/ai/tools/create-document";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getAgentById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getSiteConfig,
  saveChat,
  saveMessages,
  updateChatPinnedById,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

const MAX_CONTEXT_MESSAGES = 40;

function geolocation(request: Request) {
  const h = request.headers;
  return {
    latitude: h.get("cf-iplatitude") ?? h.get("x-vercel-ip-latitude") ?? undefined,
    longitude: h.get("cf-iplongitude") ?? h.get("x-vercel-ip-longitude") ?? undefined,
    city: h.get("cf-ipcity") ?? h.get("x-vercel-ip-city") ?? undefined,
    country: h.get("cf-ipcountry") ?? h.get("x-vercel-ip-country") ?? undefined,
  };
}

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export { getStreamContext };

export async function POST(request: Request) {
  let requestBody: PostRequestBody;
  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      messages,
      selectedChatModel,
      selectedVisibilityType,
      agentId,
      thinkingEnabled,
      isNewChat,
      summarizeTask, // 🚨 解构汇总标识
    } = requestBody;

    const [session, chat, agentRecord] = await Promise.all([
      auth(),
      isNewChat ? Promise.resolve(null) : getChatById({ id }),
      agentId ? getAgentById({ id: agentId }) : Promise.resolve(null),
    ]);

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

    const userType: UserType = session.user.type;
    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 1,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerHour) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    // ==========================================
    // 🚨 核心分支：如果是置顶对话汇总任务
    // ==========================================
    if (summarizeTask) {
      const { chatIds: targetChatIds } = JSON.parse(summarizeTask);

      // 1. 创建新对话记录
      await saveChat({
        id,
        userId: session.user.id,
        title: "信息汇总分析",
        visibility: selectedVisibilityType,
        agentId,
        agentName: agentRecord?.name ?? null,
      });

      // 2. 拉取历史记录并拼装成标准大模型对话数组格式
      // 注意：这里不再直接构建 modelMessages，而是先构建 uiMessages，以便后续进行知识库检索
      const historyMessagesForContext: Array<{ role: "user" | "assistant" | "system"; content: string; chatTitle?: string }> = [];
      
      for (const targetChatId of targetChatIds) {
        const targetChat = await getChatById({ id: targetChatId });
        if (targetChat && targetChat.userId === session.user.id) {
          const msgs = await getMessagesByChatId({ id: targetChatId });
          
          // 添加对话标题作为分隔符，帮助大模型区分不同上下文
          historyMessagesForContext.push({
            role: "user",
            content: `--- 以下是对话《${targetChat.title}》的记录 ---`,
            chatTitle: targetChat.title,
          });

          for (const m of msgs) {
            const text = Array.isArray(m.parts)
              ? m.parts
                  .filter((p: any) => p.type === "text")
                  .map((p: any) => p.text)
                  .join("")
              : "";
            if (text) {
              historyMessagesForContext.push({
                role: m.role as "user" | "assistant" | "system",
                content: text,
              });
            }
          }
        }
      }

      // 3. 在末尾追加总结指令
      historyMessagesForContext.push({
        role: "user",
        content: "请基于以上多个对话的内容，生成一份综合分析报告。**重要：请务必调用 createDocument 工具生成一个文档来展示这份报告。** 要求：1. 提取核心主题；2. 归纳关键信息；3. 分析共同点与差异；4. 给出后续行动建议。",
      });

      // ==========================================
      // 🔥 修改点：引入 Agent 能力逻辑 (参考正常聊天流程)
      // ==========================================
      
      // 4. 初始化 System Prompt
      // 先获取基础 Prompt，此时不确定是否会添加知识库
      let systemMessage = systemPrompt({
        requestHints: { longitude: undefined, latitude: undefined, city: undefined, country: undefined },
        supportsTools: true, // 🔥 汇总任务也需要支持工具
      });

      let knowledgeContext = "";

      // 5. 知识库检索逻辑 (RAG)
      // 如果启用了 Agent 且配置了知识库，尝试基于汇总上下文进行检索
      if (agentRecord?.isActive && agentRecord?.knowledgeId) {
        try {
          // 构建检索查询：使用历史消息的最后一条（即包含总结指令的那条），或者摘要所有内容
          // 这里使用最后一条指令作为查询最为精准
          const lastMsg = historyMessagesForContext[historyMessagesForContext.length - 1];
          const queryText = lastMsg?.content ?? "信息汇总分析";

          const retrieveResult = await retrieveKnowledge({
            query: queryText.slice(0, 1000),
            knowledge_ids: [agentRecord.knowledgeId],
            top_k: 5,
            recall_method: "mixed",
          });

          if (retrieveResult.code === 200 && retrieveResult.data && retrieveResult.data.length > 0) {
            const chunks = retrieveResult.data.map((r) => r.text).join("\n\n");
            knowledgeContext = `\n\n## 知识库参考内容\n以下是从知识库中检索到的相关信息，请优先基于这些内容回答用户问题。\n\n${chunks}`;
          }
        } catch (e) {
          console.warn("[chat] 知识库检索失败:", e instanceof Error ? e.message : e);
        }
      }

      // 6. 组装最终的 System Prompt
      // 优先级：Agent Prompt > 知识库内容 > 基础 System Prompt
      if (agentRecord?.isActive) {
        systemMessage = `${agentRecord.systemPrompt}${knowledgeContext}\n\n${systemMessage}`;
      } else if (!agentId) {
        // 如果没有指定 Agent，使用默认站点配置（如果需要）
        const config = await getSiteConfig();
        if (config?.defaultSystemPrompt) {
          const infrastructure = infrastructurePrompt({
            requestHints: { longitude: undefined, latitude: undefined, city: undefined, country: undefined },
            supportsTools: true,
          });
          systemMessage = `${config.defaultSystemPrompt}\n\n${infrastructure}`;
        }
      }

      // 7. 将上下文消息转换为模型可用的格式
      // 正常聊天中使用了 convertToModelMessages，这里我们手动构建标准数组
      // 也可以尝试复用 convertToModelMessages 如果格式兼容，但在汇总场景下手动构建更可控
      const modelMessages = historyMessagesForContext.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // 8. 保存用户的触发消息到数据库
      if (message?.role === "user") {
        await saveMessages({
          messages: [
            {
              chatId: id,
              id: message.id,
              role: "user",
              parts: message.parts,
              attachments: [],
              createdAt: new Date(),
            },
          ],
        });
      }

      // 9. 流式调用大模型
      const stream = createUIMessageStream({
        execute: async ({ writer: dataStream }) => {
          const result = await streamText({
            model: getLanguageModel(chatModel),
            system: systemMessage,
            messages: modelMessages,
            
            // 🔥 工具配置：不仅要 createDocument，还应支持 Agent 可能配置的其他工具
            // 这里我们保留完整的工具定义，以获得最大能力
            experimental_activeTools: [
              "getWeather", 
              "createDocument", 
              "editDocument", 
              "updateDocument", 
              "requestSuggestions"
            ],
            
            // 🔥 注入完整的工具定义
            tools: {
              getWeather,
              createDocument: createDocument({ session, dataStream, modelId: chatModel, chatId: id }),
              editDocument: editDocument({ dataStream, session }),
              updateDocument: updateDocument({ session, dataStream, modelId: chatModel }),
              requestSuggestions: requestSuggestions({ session, dataStream, modelId: chatModel }),
            },
            
            // 🔥 重试逻辑（可选，参考正常逻辑）
            // ...(其他配置)
          });

          dataStream.merge(result.toUIMessageStream());
        },
        generateId: generateUUID,
        onFinish: async ({ messages: finishedMessages }) => {
          if (finishedMessages.length > 0) {
            await saveMessages({
              messages: finishedMessages.map((currentMessage) => ({
                id: currentMessage.id,
                role: currentMessage.role,
                parts: currentMessage.parts,
                createdAt: new Date(),
                attachments: [],
                chatId: id,
              })),
            });
          }
        },
        onError: (error) => "Oops, an error occurred!",
      });

      return createUIMessageStreamResponse({ stream });
    }

    // ==========================================
    // 汇总分支结束，以下是原有正常聊天逻辑
    // ==========================================

    const isToolApprovalFlow = Boolean(messages);
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
        agentId,
        agentName: agentRecord?.name ?? null,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    let uiMessages: ChatMessage[];
    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied"
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? []
        )
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if ("toolCallId" in part && approvalStates.has(String(part.toolCallId))) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [...convertToUIMessages(messagesFromDb), message as ChatMessage];
    }

    const { longitude, latitude, city, country } = geolocation(request);
    const requestHints: RequestHints = { longitude, latitude, city, country };
    const modelConfig = chatModels.find((m) => m.id === chatModel);
    const capabilities = getCapabilities()[chatModel];
    const isReasoningModel = capabilities?.reasoning === true;
    const supportsTools = capabilities?.tools === true;
    let systemMessage = systemPrompt({ requestHints, supportsTools });

    let knowledgeContext = "";
    if (agentRecord?.isActive && agentRecord?.knowledgeId) {
      try {
        const lastUserMsg = uiMessages[uiMessages.length - 1];
        const queryText = lastUserMsg?.parts
          ?.filter((p: { type: string }) => p.type === "text")
          .map((p: { type: string; text?: string }) => (p as { text: string }).text)
          .join(" ") ?? "";
        if (queryText.trim()) {
          const retrieveResult = await retrieveKnowledge({
            query: queryText.slice(0, 1000),
            knowledge_ids: [agentRecord.knowledgeId],
            top_k: 5,
            recall_method: "mixed",
          });
          if (!isProductionEnvironment) {
            console.log("[chat] 知识库检索 query:", queryText.slice(0, 100));
          }
          if (retrieveResult.code === 200 && retrieveResult.data && retrieveResult.data.length > 0) {
            const chunks = retrieveResult.data.map((r) => r.text).join("\n\n");
            knowledgeContext = `\n\n## 知识库参考内容\n以下是从知识库中检索到的相关信息，请优先基于这些内容回答用户问题。\n\n${chunks}`;
          }
        }
      } catch (e) {
        console.warn("[chat] 知识库检索失败:", e instanceof Error ? e.message : e);
      }
    }

    if (agentRecord?.isActive) {
      systemMessage = `${agentRecord.systemPrompt}${knowledgeContext}\n\n${systemMessage}`;
    } else if (!agentId) {
      const config = await getSiteConfig();
      if (config?.defaultSystemPrompt) {
        const infrastructure = infrastructurePrompt({ requestHints, supportsTools });
        systemMessage = `${config.defaultSystemPrompt}\n\n${infrastructure}`;
      }
    }

    let modelMessages = await convertToModelMessages(uiMessages);
    if (modelMessages.length > MAX_CONTEXT_MESSAGES) {
      modelMessages = modelMessages.slice(-MAX_CONTEXT_MESSAGES);
    }

    if (message?.role === "user") {
      saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      }).catch(() => {});
    }

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        const result = await withRetry(
          () => streamText({
            model: getLanguageModel(chatModel),
            system: systemMessage,
            messages: modelMessages,
            stopWhen: stepCountIs(5),
            experimental_activeTools: isReasoningModel && !supportsTools ? [] : [
              "getWeather", "createDocument", "editDocument", "updateDocument", "requestSuggestions",
            ],
            providerOptions: {
              ...(modelConfig?.reasoningEffort && { openai: { reasoningEffort: modelConfig.reasoningEffort } }),
            },
            tools: {
              getWeather,
              createDocument: createDocument({ session, dataStream, modelId: chatModel, chatId: id}),
              editDocument: editDocument({ dataStream, session}),
              updateDocument: updateDocument({ session, dataStream, modelId: chatModel}),
              requestSuggestions: requestSuggestions({ session, dataStream, modelId: chatModel}),
            },
            experimental_telemetry: { isEnabled: isProductionEnvironment, functionId: "stream-text" },
          }),
          2,
          (attempt, error, delayMs) => {
            console.warn(`[chat] streamText retry ${attempt}:`, error instanceof Error ? error.message : error);
          }
        );

        dataStream.merge(result.toUIMessageStream({ sendReasoning: isReasoningModel && thinkingEnabled }));

        if (titlePromise) {
          try {
            const title = await titlePromise;
            dataStream.write({ type: "data-chat-title", data: title });
            updateChatTitleById({ chatId: id, title });
          } catch (_) {}
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({ id: finishedMsg.id, parts: finishedMsg.parts });
            } else {
              await saveMessages({ messages: [{ id: finishedMsg.id, role: finishedMsg.role, parts: finishedMsg.parts, createdAt: new Date(), attachments: [], chatId: id }] });
            }
          }
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              id: currentMessage.id, role: currentMessage.role, parts: currentMessage.parts, createdAt: new Date(), attachments: [], chatId: id,
            })),
          });
        }
      },
      onError: (error) => {
        if (error instanceof Error && error.message?.includes("Insufficient Balance")) {
          return "智谱 API 余额不足，请前往 open.bigmodel.cn 充值。";
        }
        return "Oops, an error occurred!";
      },
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) return;
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ streamId, chatId: id });
            await streamContext.createNewResumableStream(streamId, () => sseStream);
          }
        } catch (_) {}
      },
    });
  } catch (error) {
    const requestId = request.headers.get("x-request-id") ?? generateUUID();
    if (error instanceof ChatbotError) return error.toResponse();
    if (error instanceof Error && error.message?.includes("Insufficient Balance")) {
      return new ChatbotError("bad_request:api").toResponse();
    }
    console.error("Unhandled error in chat API:", error, { requestId });
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return new ChatbotError("bad_request:api").toResponse();
  
  const session = await auth();
  if (!session?.user) return new ChatbotError("unauthorized:chat").toResponse();
  
  const chat = await getChatById({ id });
  if (chat?.userId !== session.user.id) return new ChatbotError("forbidden:chat").toResponse();
  
  const deletedChat = await deleteChatById({ id });
  return Response.json(deletedChat, { status: 200 });
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return new ChatbotError("bad_request:api").toResponse();
  
  let body: { pinned?: boolean };
  try {
    body = (await request.json()) as { pinned?: boolean };
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }
  
  const session = await auth();
  if (!session?.user) return new ChatbotError("unauthorized:chat").toResponse();
  
  const existingChat = await getChatById({ id });
  if (existingChat?.userId !== session.user.id) return new ChatbotError("forbidden:chat").toResponse();
  
  const pinnedAt = body.pinned ? new Date() : null;
  await updateChatPinnedById({ chatId: id, pinnedAt });
  return Response.json({ id, pinnedAt }, { status: 200 });
}
