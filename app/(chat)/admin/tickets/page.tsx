import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { isAdmin } from "@/lib/utils";
import { TicketCards } from "./ticket-cards";
import { TicketManager } from "./ticket-manager";
// 如果这是你的 TicketsPage 或其他页面
import SupplyDemandEditor from '@/components/SupplyDemandEditor';



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
  // return <TicketCards />;
    return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">供需信息发布中心</h1>
        
        {/* 渲染组件 */}
        <SupplyDemandEditor />
        
      </div>
    </main>
  );
}

