import { AppShell } from "@/components/app-shell";
import { WorkspacePage } from "@/components/workspace-page";
export default function Page() {
  return (
    <AppShell>
      <WorkspacePage kind="calendar" />
    </AppShell>
  );
}
