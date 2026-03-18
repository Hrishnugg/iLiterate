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

const navGroups = [
  {
    label: "Learn",
    items: [
      { title: "Lesson Plan", href: "/lesson-plan", icon: GraduationCap },
      { title: "Library", href: "/library", icon: Library },
    ],
  },
  {
    label: "Practice",
    items: [
      { title: "Flashcards", href: "/flashcards", icon: Layers },
      { title: "Quizzes", href: "/quizzes", icon: ClipboardCheck },
    ],
  },
  {
    label: "Community",
    items: [
      { title: "Social", href: "/social", icon: Users },
      { title: "Leaderboard", href: "/leaderboard", icon: Trophy },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="iLiterate">
              <Link href="/home">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-sm font-bold">
                  iL
                </div>
                <span className="text-lg font-semibold tracking-tight">
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
                <SidebarMenuButton tooltip="Search (⌘K)">
                  <Search />
                  <span className="text-muted-foreground">Search...</span>
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
            <SidebarMenuButton
              asChild
              tooltip="Progress"
              isActive={pathname === "/progress"}
            >
              <Link href="/progress">
                <TrendingUp />
                <span>Progress</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Profile"
              isActive={pathname === "/profile"}
            >
              <Link href="/profile">
                <User />
                <span>Profile</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
