import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KaraokeSetupNoticeProps {
  title?: string;
  message: string;
}

export function KaraokeSetupNotice({
  title = "Karaoke Setup Required",
  message,
}: KaraokeSetupNoticeProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl rounded-[28px] border border-amber-300/25 bg-amber-300/[0.08] p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.12] p-3 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="size-5" />
          </div>
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {message}
              </p>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              If you just pulled the latest code, run the dedicated karaoke migration
              in Supabase: <code>023_dedicated_karaoke.sql</code>.
            </p>
            <Button asChild>
              <Link href="/library">
                <ArrowLeft className="size-4" />
                Back to Library
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
