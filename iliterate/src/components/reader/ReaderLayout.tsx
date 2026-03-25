"use client";

import { useState, useEffect, useCallback, useEffectEvent, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  PanelRight,
  Headphones,
  Zap,
  PanelLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
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
  modePanel?: React.ReactNode;
  requestRightOpen?: string | null;
  contentWidth?: "article" | "wide";
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
  modePanel,
  requestRightOpen,
  contentWidth = "article",
}: ReaderLayoutProps) {
  const router = useRouter();
  const [rightOpen, setRightOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [showAudio, setShowAudio] = useState(false);
  const [isTwoPageMode, setIsTwoPageMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("reader:twoPageMode") === "true";
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageWidth, setPageWidth] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentPagesRef = useRef<HTMLDivElement>(null);
  const isImmersiveMode = isRSVPMode;
  const openRightPanel = useEffectEvent(() => {
    setRightOpen(true);
  });
  const hideAudioPanel = useEffectEvent(() => {
    setShowAudio(false);
  });

  const showLeftSidebar = !hideLeftSidebar && leftSidebar;

  // Open right sheet when requested (e.g. highlight clicked)
  useEffect(() => {
    if (requestRightOpen) {
      openRightPanel();
    }
  }, [requestRightOpen]);

  useEffect(() => {
    if (isImmersiveMode) {
      hideAudioPanel();
    }
  }, [isImmersiveMode]);

  // Two-page mode: measure page count after render
  const calculatePages = useCallback(() => {
    if (!viewportRef.current || !contentPagesRef.current) return;
    const w = viewportRef.current.clientWidth;
    if (w === 0) return;
    setPageWidth(w);
    setTotalPages(Math.max(1, Math.ceil(contentPagesRef.current.scrollWidth / w)));
  }, []);

  useEffect(() => {
    if (!isTwoPageMode) return;
    const id = setTimeout(calculatePages, 50);
    return () => clearTimeout(id);
  }, [isTwoPageMode, calculatePages]);

  useEffect(() => {
    if (!isTwoPageMode) return;
    const observer = new ResizeObserver(calculatePages);
    if (viewportRef.current) observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [isTwoPageMode, calculatePages]);

  useEffect(() => {
    if (!isTwoPageMode) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        setCurrentPage((p) => Math.min(p + 1, totalPages - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        setCurrentPage((p) => Math.max(p - 1, 0));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isTwoPageMode, totalPages]);

  const toggleTwoPageMode = useCallback(() => {
    setIsTwoPageMode((prev) => {
      const next = !prev;
      localStorage.setItem("reader:twoPageMode", String(next));
      return next;
    });
    setCurrentPage(0);
  }, []);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      {/* Top-left back button */}
      <button
        onClick={() => router.back()}
        className="absolute left-4 top-4 z-20 flex cursor-pointer items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Go back"
      >
        <ArrowLeft className="size-5" />
      </button>

      {/* Floating toolbar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center justify-end gap-2 px-6 pb-4">
        <div className="flex flex-col overflow-hidden rounded-lg border border-primary/20 bg-primary text-primary-foreground shadow-md">
          <AnimatePresence>
            {audioPlayer && showAudio && (
              <motion.div
                key="audio-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                style={{ overflow: "hidden" }}
              >
                <div className="px-4 pt-3 pb-2">
                  {audioPlayer}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {modePanel && (
              <motion.div
                key="mode-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                style={{ overflow: "hidden" }}
              >
                {modePanel}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3 px-4 py-2">
          {/* Back button */}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
            onClick={() => router.back()}
            title="Go back"
          >
            <ArrowLeft className="size-4" />
          </Button>

          {/* Title */}
          {title && (
            <span className="max-w-[280px] truncate text-sm font-medium">
              {title}
            </span>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {bookmarkButton}

            <AnimatePresence>
              {!isImmersiveMode && (
                <motion.div
                  key="two-page-btn"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{ overflow: "hidden" }}
                  className="flex items-center"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTwoPageMode}
                    className={cn(
                      "size-8 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground",
                      isTwoPageMode && "bg-white/30"
                    )}
                    title="Two-page book mode"
                  >
                    <BookOpen className="size-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isTwoPageMode && !isImmersiveMode && (
                <motion.div
                  key="page-counter"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{ overflow: "hidden" }}
                  className="flex items-center"
                >
                  <span className="text-xs text-primary-foreground/70 tabular-nums px-1 whitespace-nowrap">
                    {currentPage + 1} / {totalPages}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {onToggleRSVP && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleRSVP}
                className={cn(
                  "size-8 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground",
                  isRSVPMode && "bg-white/30"
                )}
                title="RSVP Speed Reader"
              >
                <Zap className="size-4" />
              </Button>
            )}

            <AnimatePresence>
              {audioPlayer && !isImmersiveMode && (
                <motion.div
                  key="audio-btn"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{ overflow: "hidden" }}
                  className="flex items-center"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowAudio(!showAudio)}
                    className={cn(
                      "size-8 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground",
                      showAudio && "bg-white/30"
                    )}
                    title="Audio playback"
                  >
                    <Headphones className="size-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {showLeftSidebar && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLeftOpen(true)}
                className="size-8 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
                title="Table of Contents"
              >
                <PanelLeft className="size-4" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRightOpen(true)}
              className={cn(
                "size-8 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground",
                rightOpen && "bg-white/30"
              )}
              title="Notes & Lookups"
            >
              <PanelRight className="size-4" />
            </Button>
          </div>
          </div>{/* end toolbar row */}
        </div>{/* end pill */}
      </div>

      {/* Main content — full bleed, centered article */}
      {isTwoPageMode && !isImmersiveMode ? (
        <div ref={viewportRef} className="relative flex-1 overflow-hidden">
          {/* Page content */}
          <div
            ref={contentPagesRef}
            style={{
              height: "100%",
              columnCount: 2,
              columnFill: "auto",
              columnGap: "5rem",
              padding: "2.5rem 4rem 5rem",
              transform: `translateX(-${currentPage * pageWidth}px)`,
              transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
              willChange: "transform",
            }}
          >
            {children}
          </div>

          {/* Center divider line */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-px bg-border/40" />

          {/* Prev page button */}
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
            disabled={currentPage === 0}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border bg-background/80 p-2 shadow-sm backdrop-blur-sm transition-opacity hover:bg-accent disabled:opacity-20"
          >
            <ChevronLeft className="size-5" />
          </button>

          {/* Next page button */}
          <button
            onClick={() =>
              setCurrentPage((p) => Math.min(p + 1, totalPages - 1))
            }
            disabled={currentPage === totalPages - 1}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border bg-background/80 p-2 shadow-sm backdrop-blur-sm transition-opacity hover:bg-accent disabled:opacity-20"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      ) : (
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
            <article
              className={cn(
                "mx-auto w-full pb-24 pt-8",
                contentWidth === "wide"
                  ? "max-w-[1600px] px-6 xl:px-8"
                  : "max-w-[80ch] px-8"
              )}
            >
              {children}
            </article>
          )}
        </div>
      )}

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
