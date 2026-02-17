"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Loader2, TrendingDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DowngradeInfo {
  canDowngrade: boolean;
  currentLevel: number;
  currentCEFR: string;
  targetLevel: number;
  targetCEFR: string;
  inProgressLessons: number;
}

interface DowngradeLevelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDowngradeComplete?: () => void;
}

export function DowngradeLevelDialog({
  open,
  onOpenChange,
  onDowngradeComplete,
}: DowngradeLevelDialogProps) {
  const [info, setInfo] = useState<DowngradeInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDowngrading, setIsDowngrading] = useState(false);
  const [clearLessons, setClearLessons] = useState(true);

  // Fetch downgrade info when dialog opens
  useEffect(() => {
    if (open) {
      fetchDowngradeInfo();
    }
  }, [open]);

  const fetchDowngradeInfo = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/progress/downgrade");
      if (response.ok) {
        const data = await response.json();
        setInfo(data);
      } else {
        toast.error("Failed to load level information");
        onOpenChange(false);
      }
    } catch {
      toast.error("Failed to load level information");
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDowngrade = async () => {
    setIsDowngrading(true);
    try {
      const response = await fetch("/api/progress/downgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearInProgressLessons: clearLessons }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(
          `Level downgraded from ${result.oldCEFR} to ${result.newCEFR}`,
          {
            description: result.lessonsCleared > 0
              ? `${result.lessonsCleared} in-progress lesson(s) cleared`
              : undefined,
          }
        );
        onOpenChange(false);
        onDowngradeComplete?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to downgrade level");
      }
    } catch {
      toast.error("Failed to downgrade level");
    } finally {
      setIsDowngrading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-orange-500" />
            Downgrade Your Level?
          </DialogTitle>
          <DialogDescription>
            {isLoading ? (
              "Loading..."
            ) : info ? (
              <>
                You&apos;re currently at <strong>{info.currentCEFR}</strong> (Level {info.currentLevel}).
                This will drop you to <strong>{info.targetCEFR}</strong> (Level {info.targetLevel}).
              </>
            ) : (
              "Unable to load level information"
            )}
          </DialogDescription>
        </DialogHeader>

        {!isLoading && info && (
          <div className="space-y-4">
            {/* Warning */}
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/30">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-orange-800 dark:text-orange-200">
                  <p className="font-medium mb-1">This action:</p>
                  <ul className="list-disc list-inside space-y-1 text-orange-700 dark:text-orange-300">
                    <li>Reduces all skill levels by one tier</li>
                    <li>Resets your XP progress to 0</li>
                    <li>Cannot be undone (you&apos;ll need to earn XP again)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* In-progress lessons option */}
            {info.inProgressLessons > 0 && (
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium mb-3">
                  You have {info.inProgressLessons} in-progress lesson{info.inProgressLessons > 1 ? "s" : ""}
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="lessonOption"
                      checked={clearLessons}
                      onChange={() => setClearLessons(true)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Clear and start fresh at new level</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="lessonOption"
                      checked={!clearLessons}
                      onChange={() => setClearLessons(false)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Keep (finish at current difficulty)</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDowngrading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDowngrade}
            disabled={isLoading || isDowngrading || !info?.canDowngrade}
          >
            {isDowngrading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downgrading...
              </>
            ) : (
              "Confirm Downgrade"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
