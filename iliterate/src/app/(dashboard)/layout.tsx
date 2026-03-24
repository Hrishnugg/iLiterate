"use client";

import { usePathname } from "next/navigation";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SearchProvider } from "@/components/search/SearchContext";
import { SearchModal } from "@/components/search/SearchModal";
import { I18nProvider } from "@/lib/i18n/I18nProvider";

type LayoutMode = "chrome" | "immersive" | "split" | "library" | "karaoke";

function deriveLayoutMode(pathname: string | null): LayoutMode {
  if (!pathname) return "chrome";

  // Immersive: reader, flashcard review (handled via portal), lesson reading
  if (pathname.startsWith("/reader/") && pathname.split("/").length > 2) {
    return "immersive";
  }

  // Split: social/messaging
  if (
    pathname === "/social" ||
    pathname.startsWith("/social/") ||
    pathname === "/study-chat" ||
    pathname.startsWith("/study-chat/")
  ) {
    return "split";
  }

  // Library: full-height layout with right filter panel
  if (pathname === "/library") {
    return "library";
  }

  // Karaoke studio: dashboard shell, but full-height content canvas
  if (pathname.startsWith("/karaoke/") && pathname.split("/").length > 2) {
    return "karaoke";
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
      <I18nProvider>
        <SearchProvider>
          <SearchModal />
          <SidebarProvider defaultOpen={false}>
            <AppSidebar />
            <SidebarInset>
              <main className="h-screen">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </SearchProvider>
      </I18nProvider>
    );
  }

  // Library mode: children own the full SidebarInset height including the trigger header
  if (layoutMode === "library") {
    return (
      <I18nProvider>
        <SearchProvider>
          <SearchModal />
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="flex overflow-hidden">
              {children}
            </SidebarInset>
          </SidebarProvider>
        </SearchProvider>
      </I18nProvider>
    );
  }

  if (layoutMode === "karaoke") {
    return (
      <I18nProvider>
        <SearchProvider>
          <SearchModal />
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="overflow-hidden">
              <main className="h-screen overflow-hidden">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </SearchProvider>
      </I18nProvider>
    );
  }

  // Chrome mode: collapsible sidebar
  return (
    <I18nProvider>
      <SearchProvider>
        <SearchModal />
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <div className="flex h-10 items-center px-4 pt-4 md:hidden">
              <SidebarTrigger className="-ml-1 size-7 text-muted-foreground" />
            </div>
            <main className="mx-auto w-full max-w-6xl px-6 pb-10 pt-4 md:px-8 md:pt-8">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </SearchProvider>
    </I18nProvider>
  );
}
