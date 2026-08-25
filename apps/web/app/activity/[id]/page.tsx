import { AppShell } from "@/components/app-shell";
import { DetailView } from "@/components/detail-view";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell>
      <DetailView kind="activity" id={id} />
    </AppShell>
  );
}
