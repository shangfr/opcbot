import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { isAdmin } from "@/lib/utils";
import { AgentCards } from "./agent-cards";
import { AgentManager } from "./agent-manager";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userIsAdmin = isAdmin(session.user);

  // 管理员显示完整的 Agent 管理界面（含 CRUD）
  if (userIsAdmin) {
    return <AgentManager />;
  }

  // 普通用户显示 Agent 卡片，点击即可开始对话
  return <AgentCards />;
}
