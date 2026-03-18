"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BookmarkButtonProps {
  itemType: "content" | "lesson";
  itemId: string;
}

export function BookmarkButton({ itemType, itemId }: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    async function checkBookmark() {
      try {
        const res = await fetch(
          `/api/bookmarks/check?itemType=${itemType}&itemId=${itemId}`
        );
        if (res.ok) {
          const data = await res.json();
          setBookmarked(data.bookmarked);
        }
      } catch {
        // Silently fail — button will show as not bookmarked
      } finally {
        setIsLoading(false);
      }
    }
    checkBookmark();
  }, [itemType, itemId]);

  const toggle = useCallback(async () => {
    setIsToggling(true);
    // Optimistic update
    const prev = bookmarked;
    setBookmarked(!prev);

    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType, itemId }),
      });

      if (!res.ok) {
        setBookmarked(prev);
        toast.error("Failed to update bookmark");
        return;
      }

      const data = await res.json();
      setBookmarked(data.bookmarked);
      toast.success(data.bookmarked ? "Saved to library" : "Removed from library");
    } catch {
      setBookmarked(prev);
      toast.error("Failed to update bookmark");
    } finally {
      setIsToggling(false);
    }
  }, [bookmarked, itemType, itemId]);

  if (isLoading) {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={toggle}
      disabled={isToggling}
      title={bookmarked ? "Remove bookmark" : "Bookmark for later"}
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark for later"}
    >
      {bookmarked ? (
        <BookmarkCheck className="h-4 w-4 text-primary" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
    </Button>
  );
}
