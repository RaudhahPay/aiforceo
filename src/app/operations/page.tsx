import { Sidebar } from "@/app/_components/Sidebar";
import { DepartmentPage } from "@/app/_components/DepartmentPage";
import { loadDepartmentData } from "@/server/actions/department";

export default async function OperationsPage() {
  const data = await loadDepartmentData("coo");

  return (
    <div
      style={{
        display: "grid",
        minHeight: "100vh",
        gridTemplateColumns: "240px 1fr",
      }}
    >
      <Sidebar
        active="operations"
        remainingTokens={data.remainingTokens}
        monthlyQuota={data.monthlyQuota}
        workspaceName={data.workspace.name}
        workspaceId={data.workspace.id}
        allWorkspaces={data.allWorkspaces}
      />
      <DepartmentPage
        type="operations"
        kpi={data.kpi}
        role="coo"
        agent={data.agent}
        workspaceName={data.workspace.name}
        conversationId={data.conversationId}
        initialMessages={data.initialMessages}
        pastConversations={data.pastConversations}
      />
    </div>
  );
}
