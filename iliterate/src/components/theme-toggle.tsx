"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useT } from "@/lib/i18n/I18nProvider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useT();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMounted(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const getIcon = () => {
    if (!mounted) {
      return <Sun className="transition-transform duration-200" />;
    }
    
    switch (theme) {
      case "light":
        return <Sun className="transition-transform duration-200" />;
      case "dark":
        return <Moon className="transition-transform duration-200" />;
      case "system":
      default:
        return <Monitor className="transition-transform duration-200" />;
    }
  };

  const getThemeLabel = () => {
    if (!mounted) return t("profile.theme");

    switch (theme) {
      case "light":
        return t("profile.themeLight");
      case "dark":
        return t("profile.themeDark");
      case "system":
      default:
        return t("profile.themeSystem");
    }
  };

  // Defer the entire DropdownMenu to avoid Radix ID hydration mismatch
  if (!mounted) {
    return (
      <SidebarMenuButton tooltip={t("profile.theme")}>
        <Sun className="transition-transform duration-200" />
        <span>{t("profile.theme")}</span>
      </SidebarMenuButton>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="cursor-pointer">
          {getIcon()}
          <span>{getThemeLabel()}</span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="cursor-pointer"
        >
          <Sun className="mr-2 size-4" />
          <span>{t("profile.themeLight")}</span>
          {theme === "light" && (
            <span className="ml-auto text-xs">✓</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="cursor-pointer"
        >
          <Moon className="mr-2 size-4" />
          <span>{t("profile.themeDark")}</span>
          {theme === "dark" && (
            <span className="ml-auto text-xs">✓</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="cursor-pointer"
        >
          <Monitor className="mr-2 size-4" />
          <span>{t("profile.themeSystem")}</span>
          {theme === "system" && (
            <span className="ml-auto text-xs">✓</span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
