"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Clock } from "lucide-react";

interface UpgradePromptProps {
  dailyReviewsUsed: number;
  dailyLimit: number;
  onClose: () => void;
}

export function UpgradePrompt({
  dailyReviewsUsed,
  dailyLimit,
  onClose,
}: UpgradePromptProps) {
  return (
    <div className="w-full max-w-xl mx-auto">
      <Card>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="text-xl">Daily Limit Reached</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            You&apos;ve reviewed {dailyReviewsUsed} cards today! Come back
            tomorrow for more, or upgrade to Premium for unlimited reviews.
          </p>

          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-center gap-2 text-amber-600 font-semibold">
              <Crown className="h-5 w-5" />
              Premium Benefits
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Unlimited daily reviews</li>
              <li>Priority support</li>
              <li>Advanced statistics</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button className="w-full gap-2">
              <Crown className="h-4 w-4" />
              Upgrade to Premium
            </Button>
            <Button variant="outline" onClick={onClose} className="w-full">
              Done for Today
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Free tier: {dailyLimit} reviews per day
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
