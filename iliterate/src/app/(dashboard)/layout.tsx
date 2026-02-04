"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isReader = pathname?.startsWith("/reader/") && pathname.split("/").length > 2;

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link href="/library" className="text-lg font-semibold">
            iLiterate
          </Link>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/profile">
              <User className="h-5 w-5" />
              <span className="sr-only">Profile</span>
            </Link>
          </Button>
        </div>
      </header>
      <main className={isReader ? "" : "mx-auto max-w-7xl px-6 py-8"}>
        {children}
      </main>
    </div>
  );
}
