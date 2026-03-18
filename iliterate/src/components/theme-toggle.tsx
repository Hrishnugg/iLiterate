"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
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
    if (!mounted) return "Theme";
    
    switch (theme) {
      case "light":
        return "Light";
      case "dark":
        return "Dark";
      case "system":
      default:
        return "System";
    }
  };

  // Defer the entire DropdownMenu to avoid Radix ID hydration mismatch
  if (!mounted) {
    return (
      <SidebarMenuButton tooltip="Change theme">
        <Sun className="transition-transform duration-200" />
        <span>Theme</span>
      </SidebarMenuButton>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton tooltip="Change theme">
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
          <span>Light</span>
          {theme === "light" && (
            <span className="ml-auto text-xs">✓</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="cursor-pointer"
        >
          <Moon className="mr-2 size-4" />
          <span>Dark</span>
          {theme === "dark" && (
            <span className="ml-auto text-xs">✓</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="cursor-pointer"
        >
          <Monitor className="mr-2 size-4" />
          <span>System</span>
          {theme === "system" && (
            <span className="ml-auto text-xs">✓</span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
