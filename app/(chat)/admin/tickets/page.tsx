import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { isAdmin } from "@/lib/utils";
import { TicketCards } from "./ticket-cards";
import { TicketManager } from "./ticket-manager";

export default async function TicketsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userIsAdmin = isAdmin(session.user);

  // 管理员显示完整的工单管理界面（含 CRUD）
  if (userIsAdmin) {
    return <TicketManager />;
  }

  // 普通用户显示工单卡片，可创建/查看自己的工单
  return <TicketCards />;
}
