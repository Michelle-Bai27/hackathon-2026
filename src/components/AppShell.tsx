"use client";

import { AppProvider } from "@/context/AppContext";
import { OrgSidebar } from "@/components/sidebar/OrgSidebar";
import { UploadModal } from "@/components/upload/UploadModal";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div className="flex h-screen overflow-hidden bg-canvas text-ink">
        <OrgSidebar />
        <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
        <UploadModal />
      </div>
    </AppProvider>
  );
}
