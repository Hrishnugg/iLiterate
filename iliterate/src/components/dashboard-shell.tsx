"use client";

import { useCallback, useState } from "react";
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

const MAIN_SIDEBAR_COOKIE = "sidebar_main_state";
const MAIN_SIDEBAR_MAX_AGE = 60 * 60 * 24 * 7;

export function DashboardShell({
  children,
  defaultSidebarOpen,
  initialLocale,
}: {
  children: React.ReactNode;
  defaultSidebarOpen: boolean;
  initialLocale?: string;
}) {
  const pathname = usePathname();
  const layoutMode = deriveLayoutMode(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);

  const handleSidebarChange = useCallback((open: boolean) => {
    setSidebarOpen(open);
    document.cookie = `${MAIN_SIDEBAR_COOKIE}=${open}; path=/; max-age=${MAIN_SIDEBAR_MAX_AGE}`;
  }, []);

  // Immersive mode: no sidebar, no header, full viewport
  if (layoutMode === "immersive") {
    return (
      <I18nProvider initialLocale={initialLocale}>
        <main className="min-h-screen">{children}</main>
      </I18nProvider>
    );
  }

  // All other modes share a single SidebarProvider so the sidebar is never
  // unmounted/remounted on navigation, which would trigger the close animation.
  let inset: React.ReactNode;
  if (layoutMode === "split") {
    inset = (
      <SidebarInset>
        <main className="h-screen">{children}</main>
      </SidebarInset>
    );
  } else if (layoutMode === "library") {
    inset = (
      <SidebarInset className="flex overflow-hidden">
        {children}
      </SidebarInset>
    );
  } else if (layoutMode === "karaoke") {
    inset = (
      <SidebarInset className="overflow-hidden">
        <main className="h-screen overflow-hidden">{children}</main>
      </SidebarInset>
    );
  } else {
    inset = (
      <SidebarInset>
        <div className="flex h-10 items-center px-4 pt-4 md:hidden">
          <SidebarTrigger className="-ml-1 size-7 text-muted-foreground" />
        </div>
        <main className="mx-auto w-full max-w-6xl px-6 pb-10 pt-4 md:px-8 md:pt-8">
          {children}
        </main>
      </SidebarInset>
    );
  }

  return (
    <I18nProvider initialLocale={initialLocale}>
      <SearchProvider>
        <SearchModal />
        <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarChange}>
          <AppSidebar />
          {inset}
        </SidebarProvider>
      </SearchProvider>
    </I18nProvider>
  );
}
