"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Library,
  Layers,
  ClipboardCheck,
  PanelLeftClose,
  PanelLeftOpen,
  TrendingUp,
  GraduationCap,
  Users,
  Sparkles,
  Trophy,
  Search,
  BookOpen,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSearch } from "@/components/search/SearchContext";
import { useT, T } from "@/lib/i18n/I18nProvider";
import { SidebarUserMenu } from "@/components/sidebar-user-menu";

export function AppSidebar() {
  const pathname = usePathname();
  const { openSearch } = useSearch();
  const { isMobile, state, toggleSidebar } = useSidebar();
  const t = useT();
  const SidebarToggleIcon = state === "collapsed" ? PanelLeftOpen : PanelLeftClose;
  const sidebarToggleLabel = isMobile
    ? t("nav.closeSidebar")
    : state === "collapsed"
      ? t("nav.expandSidebar")
      : t("nav.collapseSidebar");

  const navGroups = [
    {
      labelKey: "nav.learn",
      items: [
        { titleKey: "nav.lessonPlan", href: "/lesson-plan", icon: GraduationCap },
        { titleKey: "nav.library", href: "/library", icon: Library },
        { titleKey: "nav.studyChat", href: "/study-chat", icon: Sparkles },
        { titleKey: "nav.progress", href: "/progress", icon: TrendingUp },
      ],
    },
    {
      labelKey: "nav.practice",
      items: [
        { titleKey: "nav.flashcards", href: "/flashcards", icon: Layers },
        { titleKey: "nav.quizzes", href: "/quizzes", icon: ClipboardCheck },
      ],
    },
    {
      labelKey: "nav.community",
      items: [
        { titleKey: "nav.social", href: "/social", icon: Users },
        { titleKey: "nav.leaderboard", href: "/leaderboard", icon: Trophy },
      ],
    },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="iLiterate">
              <Link href="/home" className="group-data-[collapsible=icon]:justify-center">
                <BookOpen className="size-6 text-primary" />
                <span className="text-lg font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
                  iLiterate
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Search / Command Palette trigger */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Search (⌘K)" onClick={openSearch} className="cursor-pointer">
                  <Search />
                  <T id="nav.search" className="text-muted-foreground" />
                  <kbd className="ml-auto text-[10px] font-mono text-muted-foreground opacity-60">
                    ⌘K
                  </kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Grouped navigation */}
        {navGroups.map((group) => (
          <SidebarGroup key={group.labelKey}>
            <SidebarGroupLabel><T id={group.labelKey} /></SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname?.startsWith(item.href + "/");
                  const resolvedTitle = t(item.titleKey);

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={resolvedTitle}
                      >
                        <Link href={item.href}>
                          <item.icon />
                          <T id={item.titleKey} />
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleSidebar}
              tooltip={sidebarToggleLabel}
              className="cursor-pointer"
            >
              <SidebarToggleIcon />
              <span>{sidebarToggleLabel}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarUserMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
