"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  PanelRight,
  Headphones,
  Zap,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface ReaderLayoutProps {
  children: React.ReactNode;
  leftSidebar?: React.ReactNode;
  rightSidebar: React.ReactNode;
  audioPlayer?: React.ReactNode;
  bookmarkButton?: React.ReactNode;
  title?: string;
  contentScrollRef?: React.RefObject<HTMLDivElement | null>;
  hideLeftSidebar?: boolean;
  isRSVPMode?: boolean;
  onToggleRSVP?: () => void;
  requestRightOpen?: string | null;
}

export function ReaderLayout({
  children,
  leftSidebar,
  rightSidebar,
  audioPlayer,
  bookmarkButton,
  title,
  contentScrollRef,
  hideLeftSidebar = false,
  isRSVPMode = false,
  onToggleRSVP,
  requestRightOpen,
}: ReaderLayoutProps) {
  const router = useRouter();
  const [rightOpen, setRightOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [showAudio, setShowAudio] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const lastScrollY = useRef(0);
  const toolbarTimeout = useRef<NodeJS.Timeout | null>(null);

  const showLeftSidebar = !hideLeftSidebar && leftSidebar;

  // Open right sheet when requested (e.g. highlight clicked)
  useEffect(() => {
    if (requestRightOpen) {
      setRightOpen(true);
    }
  }, [requestRightOpen]);

  // Floating toolbar: show on scroll up, hide on scroll down
  const handleScroll = useCallback(() => {
    const container = contentScrollRef?.current;
    if (!container) return;

    const currentY = container.scrollTop;
    if (currentY < lastScrollY.current || currentY < 100) {
      setToolbarVisible(true);
    } else if (currentY > lastScrollY.current && currentY > 100) {
      setToolbarVisible(false);
    }
    lastScrollY.current = currentY;

    // Always show toolbar after stopping scroll
    if (toolbarTimeout.current) clearTimeout(toolbarTimeout.current);
    toolbarTimeout.current = setTimeout(() => setToolbarVisible(true), 1500);
  }, [contentScrollRef]);

  useEffect(() => {
    const container = contentScrollRef?.current;
    if (!container || isRSVPMode) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [contentScrollRef, handleScroll, isRSVPMode]);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      {/* Thin progress-colored top bar — placeholder for reading progress */}

      {/* Floating toolbar */}
      <div
        className={cn(
          "absolute left-0 right-0 top-0 z-20 flex items-center justify-center px-6 pt-4 transition-all duration-300",
          toolbarVisible
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0"
        )}
      >
        <div className="flex items-center gap-3 rounded-lg border bg-background/85 px-4 py-2 shadow-sm backdrop-blur-sm">
          {/* Back button */}
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => router.back()}
            title="Go back"
          >
            <ArrowLeft className="size-4" />
          </Button>

          <div className="h-4 w-px bg-border" />

          {/* Title */}
          {title && (
            <span className="max-w-[280px] truncate text-sm font-medium">
              {title}
            </span>
          )}

          <div className="h-4 w-px bg-border" />

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {bookmarkButton}

            {onToggleRSVP && (
              <Button
                variant={isRSVPMode ? "default" : "ghost"}
                size="icon"
                onClick={onToggleRSVP}
                className="size-8"
                title="RSVP Speed Reader"
              >
                <Zap className="size-4" />
              </Button>
            )}

            {audioPlayer && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowAudio(!showAudio)}
                className={cn("size-8", showAudio && "bg-accent")}
                title="Audio playback"
              >
                <Headphones className="size-4" />
              </Button>
            )}

            {showLeftSidebar && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLeftOpen(true)}
                className="size-8"
                title="Table of Contents"
              >
                <PanelLeft className="size-4" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRightOpen(true)}
              className={cn("size-8", rightOpen && "bg-accent")}
              title="Notes & Lookups"
            >
              <PanelRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Audio player bar — below toolbar when visible */}
      {audioPlayer && showAudio && (
        <div className="z-10 border-b bg-muted/30 px-4 py-2 pt-16">
          {audioPlayer}
        </div>
      )}

      {/* Main content — full bleed, centered article */}
      <div
        ref={contentScrollRef}
        className={cn(
          "flex-1",
          isRSVPMode ? "overflow-hidden" : "overflow-y-auto"
        )}
      >
        {isRSVPMode ? (
          children
        ) : (
          <article className="mx-auto max-w-[65ch] px-8 pb-24 pt-20">
            {children}
          </article>
        )}
      </div>

      {/* Right Sheet — Notes & Lookups */}
      <Sheet open={rightOpen} onOpenChange={setRightOpen}>
        <SheetContent side="right" className="w-[360px] overflow-y-auto p-0">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="text-sm font-semibold">
              Notes & Lookups
            </SheetTitle>
          </SheetHeader>
          <div>{rightSidebar}</div>
        </SheetContent>
      </Sheet>

      {/* Left Sheet — Table of Contents */}
      {showLeftSidebar && (
        <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
          <SheetContent side="left" className="w-[300px] overflow-y-auto p-0">
            <SheetHeader className="border-b px-5 py-4">
              <SheetTitle className="text-sm font-semibold">
                Table of Contents
              </SheetTitle>
            </SheetHeader>
            <div className="p-4">{leftSidebar}</div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
