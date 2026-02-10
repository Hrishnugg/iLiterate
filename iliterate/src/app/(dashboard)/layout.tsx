"use client";

import { usePathname } from "next/navigation";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isReader =
    pathname?.startsWith("/reader/") && pathname.split("/").length > 2;

  // Derive a readable page title from the pathname
  const pageTitle = (() => {
    const segment = pathname?.split("/").filter(Boolean)[0] ?? "library";
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  })();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 !h-4" />
          <span className="text-sm font-medium">{pageTitle}</span>
        </header>
        <main className={isReader ? "" : "mx-auto w-full max-w-7xl px-6 py-8"}>
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
