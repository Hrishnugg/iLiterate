"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface PillTabOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface PillTabsProps<T extends string> {
  options: PillTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  layoutId: string;
  className?: string;
  itemClassName?: string;
}

export function PillTabs<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  className,
  itemClassName,
}: PillTabsProps<T>) {
  return (
    <div className={cn("inline-flex rounded-lg bg-muted p-[3px]", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "relative cursor-pointer px-3 py-1 text-sm font-medium transition-colors duration-150",
            value === opt.value ? "text-primary" : "text-muted-foreground hover:text-foreground",
            itemClassName
          )}
        >
          {value === opt.value && (
            <motion.div
              layoutId={layoutId}
              className="absolute inset-0 rounded-md bg-primary/20 shadow-sm"
              transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
