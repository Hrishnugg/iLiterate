"use client";

import { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OfflineIndicatorProps {
  isOffline: boolean;
  pendingActions: number;
  onSync?: () => void;
  className?: string;
}

export function OfflineIndicator({
  isOffline,
  pendingActions,
  onSync,
  className,
}: OfflineIndicatorProps) {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (isOffline || pendingActions > 0) {
      const frame = window.requestAnimationFrame(() => setShowBanner(true));
      return () => window.cancelAnimationFrame(frame);
    }

    const timer = window.setTimeout(() => setShowBanner(false), 3000);
    return () => window.clearTimeout(timer);
  }, [isOffline, pendingActions]);

  if (!showBanner) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-2 text-sm",
        isOffline
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
          : "border-green-500/30 bg-green-500/10 text-green-700",
        className
      )}
    >
      {isOffline ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span className="flex-1">
            You are offline. {pendingActions > 0 && `${pendingActions} changes pending.`}
          </span>
        </>
      ) : (
        <>
          <Wifi className="h-4 w-4" />
          <span className="flex-1">
            {pendingActions > 0
              ? `${pendingActions} changes syncing...`
              : "All changes synced"}
          </span>
          {pendingActions > 0 && onSync && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSync}
              className="h-auto py-1 px-2"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Sync now
            </Button>
          )}
        </>
      )}
    </div>
  );
}
