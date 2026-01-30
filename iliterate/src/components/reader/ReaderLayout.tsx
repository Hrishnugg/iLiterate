"use client";

import { useState } from "react";
import { PanelLeft, PanelRight, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReaderLayoutProps {
  children: React.ReactNode;
  leftSidebar: React.ReactNode;
  rightSidebar: React.ReactNode;
  audioPlayer?: React.ReactNode;
  title?: string;
}

export function ReaderLayout({
  children,
  leftSidebar,
  rightSidebar,
  audioPlayer,
  title,
}: ReaderLayoutProps) {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [showAudio, setShowAudio] = useState(false);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left Sidebar - Table of Contents */}
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

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLeftOpen(!leftOpen)}
              className={cn("h-8 w-8", leftOpen && "bg-accent")}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            {title && (
              <span className="ml-2 text-sm font-medium truncate max-w-xs">
                {title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
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
        <div className="flex-1 overflow-y-auto">
          <article className="mx-auto max-w-3xl px-8 py-12">
            {children}
          </article>
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
