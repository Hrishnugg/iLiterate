"use client";

import { usePathname } from "next/navigation";

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
        <div className="mx-auto flex h-14 max-w-7xl items-center px-6">
          <h1 className="text-lg font-semibold">iLiterate</h1>
        </div>
      </header>
      <main className={isReader ? "" : "mx-auto max-w-7xl px-6 py-8"}>
        {children}
      </main>
    </div>
  );
}
