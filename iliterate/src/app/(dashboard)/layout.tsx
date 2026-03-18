"use client";

import { usePathname } from "next/navigation";

import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

type LayoutMode = "chrome" | "immersive" | "split";

function deriveLayoutMode(pathname: string | null): LayoutMode {
  if (!pathname) return "chrome";

  // Immersive: reader, flashcard review (handled via portal), lesson reading
  if (pathname.startsWith("/reader/") && pathname.split("/").length > 2) {
    return "immersive";
  }

  // Split: social/messaging
  if (pathname === "/social" || pathname.startsWith("/social/")) {
    return "split";
  }

  return "chrome";
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const layoutMode = deriveLayoutMode(pathname);

  // Immersive mode: no sidebar, no header, full viewport
  if (layoutMode === "immersive") {
    return <main className="min-h-screen">{children}</main>;
  }

  // Split mode: sidebar collapses to icon rail
  if (layoutMode === "split") {
    return (
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset>
          <main className="h-screen">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  // Chrome mode: sidebar with hover-expand, no top header bar
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <main className="mx-auto w-full max-w-6xl px-8 py-10">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
