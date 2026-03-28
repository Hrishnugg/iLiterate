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
import { useT } from "@/lib/i18n/I18nProvider";

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
  const t = useT();
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
        toast.error(t("downgrade.failedToLoad"));
        onOpenChange(false);
      }
    } catch {
      toast.error(t("downgrade.failedToLoad"));
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
          t("downgrade.success").replace("{old}", result.oldCEFR).replace("{new}", result.newCEFR),
          {
            description: result.lessonsCleared > 0
              ? t("downgrade.lessonsCleared").replace("{count}", String(result.lessonsCleared))
              : undefined,
          }
        );
        onOpenChange(false);
        onDowngradeComplete?.();
      } else {
        const error = await response.json();
        toast.error(error.error || t("downgrade.failedToDowngrade"));
      }
    } catch {
      toast.error(t("downgrade.failedToDowngrade"));
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
            {t("downgrade.title")}
          </DialogTitle>
          <DialogDescription>
            {isLoading ? (
              t("downgrade.loading")
            ) : info ? (
              <>
                {t("downgrade.currentAt")
                  .replace("{current}", info.currentCEFR)
                  .replace("{level}", String(info.currentLevel))
                  .replace("{target}", info.targetCEFR)
                  .replace("{targetLevel}", String(info.targetLevel))}
              </>
            ) : (
              t("downgrade.unableToLoad")
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
                  <p className="font-medium mb-1">{t("downgrade.thisAction")}</p>
                  <ul className="list-disc list-inside space-y-1 text-orange-700 dark:text-orange-300">
                    <li>{t("downgrade.reducesLevels")}</li>
                    <li>{t("downgrade.resetsXP")}</li>
                    <li>{t("downgrade.cannotUndo")}</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* In-progress lessons option */}
            {info.inProgressLessons > 0 && (
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium mb-3">
                  {(info.inProgressLessons > 1 ? t("downgrade.inProgressLessonsPlural") : t("downgrade.inProgressLessons")).replace("{count}", String(info.inProgressLessons))}
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
                    <span className="text-sm">{t("downgrade.clearLessons")}</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="lessonOption"
                      checked={!clearLessons}
                      onChange={() => setClearLessons(false)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{t("downgrade.keepLessons")}</span>
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
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDowngrade}
            disabled={isLoading || isDowngrading || !info?.canDowngrade}
          >
            {isDowngrading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("downgrade.downgrading")}
              </>
            ) : (
              t("downgrade.confirm")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
