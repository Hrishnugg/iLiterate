"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Library,
  Layers,
  ClipboardCheck,
  User,
  TrendingUp,
  GraduationCap,
  Users,
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
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSearch } from "@/components/search/SearchContext";
import { useT } from "@/lib/i18n/I18nProvider";

export function AppSidebar() {
  const pathname = usePathname();
  const { openSearch } = useSearch();
  const t = useT();

  const navGroups = [
    {
      label: t("nav.learn"),
      items: [
        { title: t("nav.lessonPlan"), href: "/lesson-plan", icon: GraduationCap },
        { title: t("nav.library"), href: "/library", icon: Library },
        { title: t("nav.progress"), href: "/progress", icon: TrendingUp },
      ],
    },
    {
      label: t("nav.practice"),
      items: [
        { title: t("nav.flashcards"), href: "/flashcards", icon: Layers },
        { title: t("nav.quizzes"), href: "/quizzes", icon: ClipboardCheck },
      ],
    },
    {
      label: t("nav.community"),
      items: [
        { title: t("nav.social"), href: "/social", icon: Users },
        { title: t("nav.leaderboard"), href: "/leaderboard", icon: Trophy },
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
                  <span className="text-muted-foreground">{t("nav.search")}</span>
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
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname?.startsWith(item.href + "/");

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.title}</span>
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
            <ThemeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={t("nav.profile")}
              isActive={pathname === "/profile"}
            >
              <Link href="/profile">
                <User />
                <span>{t("nav.profile")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
