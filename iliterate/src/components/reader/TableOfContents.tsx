"use client";

import { cn } from "@/lib/utils";

interface TOCItem {
  id: string;
  title: string;
  level: number;
}

interface TableOfContentsProps {
  items: TOCItem[];
  activeId?: string;
  onItemClick?: (id: string) => void;
}

export function TableOfContents({
  items,
  activeId,
  onItemClick,
}: TableOfContentsProps) {
  if (items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No table of contents available.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Contents
      </h3>
      <nav className="space-y-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemClick?.(item.id)}
            className={cn(
              "block w-full text-left text-sm transition-colors hover:text-foreground",
              "py-1 px-2 rounded-md",
              item.level === 1 && "font-medium",
              item.level === 2 && "pl-4",
              item.level === 3 && "pl-8",
              activeId === item.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground"
            )}
          >
            {item.title}
          </button>
        ))}
      </nav>
    </div>
  );
}
