"use client";

import { useState, useEffect } from "react";
import { PanelLeft, PanelRight, Headphones, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReaderLayoutProps {
  children: React.ReactNode;
  leftSidebar?: React.ReactNode;
  rightSidebar: React.ReactNode;
  audioPlayer?: React.ReactNode;
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
  title,
  contentScrollRef,
  hideLeftSidebar = false,
  isRSVPMode = false,
  onToggleRSVP,
  requestRightOpen,
}: ReaderLayoutProps) {
  const [leftOpen, setLeftOpen] = useState(!hideLeftSidebar);
  const [rightOpen, setRightOpen] = useState(true);
  const [showAudio, setShowAudio] = useState(false);

  // Open right sidebar when requested (e.g. highlight clicked)
  useEffect(() => {
    if (requestRightOpen) {
      setRightOpen(true);
    }
  }, [requestRightOpen]);

  // Don't render left sidebar at all if it should be hidden and there's no content
  const showLeftSidebar = !hideLeftSidebar && leftSidebar;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left Sidebar - Table of Contents */}
      {showLeftSidebar && (
        <aside
          className={cn(
            "flex-shrink-0 border-r bg-muted/30 transition-all duration-300 ease-in-out overflow-hidden",
            leftOpen ? "w-64 opacity-100" : "w-0 opacity-0"
          )}
        >
          <div className="h-full w-64 overflow-y-auto p-4">
            {leftSidebar}
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            {showLeftSidebar && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLeftOpen(!leftOpen)}
                className={cn("h-8 w-8", leftOpen && "bg-accent")}
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}
            {title && (
              <span className={cn("text-sm font-medium truncate max-w-xs", showLeftSidebar && "ml-2")}>
                {title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onToggleRSVP && (
              <Button
                variant={isRSVPMode ? "default" : "ghost"}
                size="icon"
                onClick={onToggleRSVP}
                className="h-8 w-8"
                title="RSVP Speed Reader"
              >
                <Zap className="h-4 w-4" />
              </Button>
            )}
            {audioPlayer && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAudio(!showAudio)}
                  className={cn("h-8 w-8", showAudio && "bg-accent")}
                  title="Audio playback"
                >
                  <Headphones className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRightOpen(!rightOpen)}
              className={cn("h-8 w-8", rightOpen && "bg-accent")}
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Audio player bar */}
        {audioPlayer && showAudio && (
          <div className="border-b bg-muted/30 px-4 py-2">
            {audioPlayer}
          </div>
        )}

        {/* Content */}
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
            <article className="mx-auto max-w-3xl px-8 py-12">
              {children}
            </article>
          )}
        </div>
      </div>

      {/* Right Sidebar - Notes & Recent Lookups */}
      <aside
        className={cn(
          "flex-shrink-0 border-l bg-muted/30 transition-all duration-300 ease-in-out overflow-hidden",
          rightOpen ? "w-80 opacity-100" : "w-0 opacity-0"
        )}
      >
        <div className="h-full w-80 overflow-y-auto">
          {rightSidebar}
        </div>
      </aside>
    </div>
  );
}
