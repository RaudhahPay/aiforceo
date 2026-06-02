import { Sidebar } from "@/app/_components/Sidebar";
import { DepartmentPage } from "@/app/_components/DepartmentPage";
import { loadDepartmentData } from "@/server/actions/department";

export default async function SalesPage() {
  const data = await loadDepartmentData("cmo");

  return (
    <div
      style={{
        display: "grid",
        minHeight: "100vh",
        gridTemplateColumns: "240px 1fr",
      }}
    >
      <Sidebar
        active="sales"
        remainingTokens={data.remainingTokens}
        monthlyQuota={data.monthlyQuota}
        workspaceName={data.workspace.name}
        workspaceId={data.workspace.id}
        allWorkspaces={data.allWorkspaces}
      />
      <DepartmentPage
        type="sales"
        kpi={data.kpi}
        monthlyRecords={data.monthlyRecords}
        defaultMonth={data.selectedMonth}
        industry={data.industry}
        role="cmo"
        agent={data.agent}
        workspaceName={data.workspace.name}
        conversationId={data.conversationId}
        initialMessages={data.initialMessages}
        pastConversations={data.pastConversations}
      />
    </div>
  );
}
