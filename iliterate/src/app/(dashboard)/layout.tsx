import { cookies } from "next/headers";

import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get("sidebar_main_state");
  const defaultSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : true;
  const initialLocale = cookieStore.get("i18n_locale")?.value ?? "en";

  return (
    <DashboardShell defaultSidebarOpen={defaultSidebarOpen} initialLocale={initialLocale}>
      {children}
    </DashboardShell>
  );
}
