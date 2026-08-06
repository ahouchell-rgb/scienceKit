import { AppShell } from "@/components/AppShell";
import { IntelligenceNotice } from "@/components/intelligence/IntelligencePage";

export default function OperatingSystemLoading() {
  return (
    <AppShell>
      <IntelligenceNotice>Preparing your role-scoped intelligence briefing…</IntelligenceNotice>
    </AppShell>
  );
}
