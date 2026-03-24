"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "motion/react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Check,
  FileImage,
  FileText,
  Languages,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import type {
  StudyChatAction,
  StudyChatAttachedUpload,
  StudyChatSessionSummary,
  StudyChatThread,
  StudyChatViewerLanguages,
} from "@/lib/study-chat/types";
import { cn } from "@/lib/utils";
import type { StudyChatMessage } from "@/types/database";

interface SessionsResponse {
  sessions: StudyChatSessionSummary[];
  viewerLanguages: StudyChatViewerLanguages;
}

interface SessionResponse extends StudyChatThread {
  sessions?: StudyChatSessionSummary[];
  viewerLanguages?: StudyChatViewerLanguages;
}

interface UploadResponse {
  id: string;
}

const ACCEPTED_STUDY_UPLOADS =
  "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp";

const QUICK_ACTIONS: Array<{
  action: StudyChatAction;
  label: string;
  prompt: string;
  Icon: ComponentType<{ className?: string }>;
}> = [
  {
    action: "summary",
    label: "Summarize",
    prompt:
      "Summarize the uploaded material for me. Focus on the main ideas, structure, and details I should study first.",
    Icon: Sparkles,
  },
  {
    action: "translation",
    label: "Translate",
    prompt:
      "Translate the uploaded material into my native language. If it is too long, translate the most important sections and explain the rest at a high level.",
    Icon: Languages,
  },
  {
    action: "vocabulary",
    label: "Key vocab",
    prompt:
      "Pull out the most useful vocabulary and phrases from the uploaded material for a learner.",
    Icon: NotebookPen,
  },
];

function relativeTime(value: string | null | undefined) {
  if (!value) {
    return "Just now";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Just now";
  }

  return formatDistanceToNow(parsed, { addSuffix: true });
}

function uploadIcon(upload: StudyChatAttachedUpload) {
  return upload.kind === "image" ? FileImage : FileText;
}

function uploadLabel(upload: StudyChatAttachedUpload) {
  return upload.title || upload.original_filename || "Untitled upload";
}

function messageBubbleTone(message: StudyChatMessage) {
  return message.role === "user"
    ? "bg-primary text-primary-foreground"
    : "border border-border/70 bg-background text-foreground";
}

export function StudyChatClient() {
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [sessions, setSessions] = useState<StudyChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [thread, setThread] = useState<StudyChatThread | null>(null);
  const [viewerLanguages, setViewerLanguages] = useState<StudyChatViewerLanguages>({
    nativeLanguage: "english",
    targetLanguage: "english",
  });
  const [draft, setDraft] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteTitle, setConfirmDeleteTitle] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread?.messages.length]);

  useEffect(() => {
    let cancelled = false;

    async function loadSessions() {
      try {
        setLoadingSessions(true);
        const response = await fetch("/api/study-chat/sessions");
        const payload = (await response.json().catch(() => null)) as
          | SessionsResponse
          | { error?: string }
          | null;

        if (!response.ok) {
          throw new Error(payload && "error" in payload ? payload.error : "Failed to load sessions");
        }

        if (cancelled || !payload || !("sessions" in payload)) {
          return;
        }

        setSessions(payload.sessions);
        setViewerLanguages(payload.viewerLanguages);

        if (payload.sessions.length === 0) {
          setActiveSessionId(null);
          setThread(null);
          return;
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load study chat");
        }
      } finally {
        if (!cancelled) {
          setLoadingSessions(false);
        }
      }
    }

    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    let cancelled = false;

    async function loadThread() {
      try {
        setLoadingThread(true);
        const response = await fetch(`/api/study-chat/sessions/${activeSessionId}/messages`);
        const payload = (await response.json().catch(() => null)) as
          | SessionResponse
          | { error?: string }
          | null;

        if (!response.ok) {
          throw new Error(payload && "error" in payload ? payload.error : "Failed to load thread");
        }

        if (cancelled || !payload || !("session" in payload)) {
          return;
        }

        setThread({
          session: payload.session,
          messages: payload.messages,
          uploads: payload.uploads,
        });

        if (payload.viewerLanguages) {
          setViewerLanguages(payload.viewerLanguages);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load thread");
        }
      } finally {
        if (!cancelled) {
          setLoadingThread(false);
        }
      }
    }

    void loadThread();

    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  async function createSession(input?: { title?: string; uploadIds?: string[] }) {
    const response = await fetch("/api/study-chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
    });
    const payload = (await response.json().catch(() => null)) as
      | SessionResponse
      | { error?: string }
      | null;

    if (!response.ok || !payload || !("session" in payload)) {
      throw new Error(payload && "error" in payload ? payload.error : "Failed to create study chat");
    }

    if (payload.sessions) {
      setSessions(payload.sessions);
    }

    setActiveSessionId(payload.session.id);
    setThread({
      session: payload.session,
      messages: payload.messages,
      uploads: payload.uploads,
    });
    setShowMobileDetail(true);

    return payload.session.id;
  }

  async function sendPrompt(input: {
    sessionId: string;
    body: string;
    action?: StudyChatAction;
    uploadIds?: string[];
  }) {
    const response = await fetch(`/api/study-chat/sessions/${input.sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: input.body,
        action: input.action ?? "chat",
        uploadIds: input.uploadIds,
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | SessionResponse
      | { error?: string }
      | null;

    if (!response.ok || !payload || !("session" in payload)) {
      throw new Error(payload && "error" in payload ? payload.error : "Failed to send message");
    }

    if (payload.sessions) {
      setSessions(payload.sessions);
    }

    setActiveSessionId(payload.session.id);
    setThread({
      session: payload.session,
      messages: payload.messages,
      uploads: payload.uploads,
    });
    setShowMobileDetail(true);
  }

  function handleNewSession() {
    setActiveSessionId(null);
    setThread(null);
    setShowMobileDetail(true);
  }

  async function handleSend(action: StudyChatAction = "chat", promptText?: string) {
    const body = (promptText ?? draft).trim();
    if (!body) {
      return;
    }

    try {
      setIsSending(true);
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = await createSession();
      }

      await sendPrompt({
        sessionId,
        body,
        action,
      });

      if (!promptText) {
        setDraft("");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  async function uploadStudyFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    try {
      setIsUploading(true);
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("scope", "study_chat");

          const response = await fetch("/api/uploads", {
            method: "POST",
            body: formData,
          });
          const payload = (await response.json().catch(() => null)) as
            | UploadResponse
            | { error?: string }
            | null;

          if (!response.ok || !payload || !("id" in payload)) {
            throw new Error(payload && "error" in payload ? payload.error : "Failed to upload file");
          }

          return payload.id;
        })
      );

      if (uploaded.length === 0) {
        return;
      }

      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = await createSession({ uploadIds: uploaded });
      }

      await sendPrompt({
        sessionId,
        body:
          "I've uploaded new study material. Tell me what it contains and what I can do with it in this study chat.",
        action: "chat",
        uploadIds: activeSessionId ? uploaded : undefined,
      });

      toast.success(files.length === 1 ? "Study material uploaded" : "Study materials uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload study material");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleRename(sessionId: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    try {
      setIsRenaming(true);
      const response = await fetch(`/api/study-chat/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const payload = await response.json().catch(() => null) as { sessions?: StudyChatSessionSummary[] } | { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload && "error" in payload ? payload.error : "Failed to rename");
      }
      if (payload && "sessions" in payload && payload.sessions) {
        setSessions(payload.sessions);
      }
      if (thread?.session.id === sessionId) {
        setThread((t) => t ? { ...t, session: { ...t.session, title: trimmed } } : t);
      }
      setRenamingId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename session");
    } finally {
      setIsRenaming(false);
    }
  }

  async function handleDelete(sessionId: string) {
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/study-chat/sessions/${sessionId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null) as { sessions?: StudyChatSessionSummary[] } | { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload && "error" in payload ? payload.error : "Failed to delete");
      }
      const remaining = (payload && "sessions" in payload && payload.sessions) ? payload.sessions : sessions.filter((s) => s.id !== sessionId);
      setSessions(remaining);
      setConfirmDeleteId(null);
      if (activeSessionId === sessionId) {
        setActiveSessionId(remaining[0]?.id ?? null);
        setThread(null);
        setShowMobileDetail(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete session");
    } finally {
      setIsDeleting(false);
    }
  }

  const leftRail = (
    <div className="flex h-full min-h-0 flex-col" style={{ background: "hsl(var(--sidebar-background, var(--background)))" }}>
      {/* Rail header */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1 size-8 text-muted-foreground md:hidden" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold tracking-tight">Study Chat</p>
          </div>
          <button
            type="button"
            onClick={() => void handleNewSession()}
            title="New session"
            className="flex h-7 items-center gap-1.5 rounded-lg bg-primary/15 px-2.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary/25"
          >
            <MessageSquarePlus className="size-3.5" />
            New
          </button>
        </div>

      </div>

      {/* Divider */}
      <div className="h-px bg-border/40" />

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loadingSessions ? (
          <div className="space-y-0.5">
            {[40, 56, 32, 48, 36].map((w, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-2">
                <div
                  className="h-3 animate-pulse rounded-md bg-muted-foreground/15"
                  style={{ width: `${w}%` }}
                />
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 px-4 py-6 text-center">
            <p className="text-[12px] text-muted-foreground">Upload something to start a grounded study thread.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sessions.map((session) => {
              const isActive = activeSessionId === session.id;
              const isMenuOpen = menuOpenId === session.id;
              const isRenameMode = renamingId === session.id;

              return (
                <div
                  key={session.id}
                  className={cn(
                    "group relative rounded-lg transition-all duration-150",
                    isActive ? "bg-accent" : "hover:bg-accent/60"
                  )}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenuOpenId(session.id);
                  }}
                >

                  {/* Rename inline mode */}
                  {isRenameMode ? (
                    <div className="flex items-center gap-1 px-2 py-2">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => setRenamingId(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRename(session.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="min-w-0 flex-1 bg-transparent text-[13px] leading-snug text-foreground outline-none border-b border-primary/50"
                        disabled={isRenaming}
                      />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void handleRename(session.id)}
                        disabled={isRenaming || !renameValue.trim()}
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-primary hover:bg-primary/15 disabled:opacity-40"
                      >
                        {isRenaming ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                      </button>
                    </div>
                  ) : (
                    /* Normal session row */
                    <div className="flex items-center gap-1 px-2 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSessionId(session.id);
                          setShowMobileDetail(true);
                          setMenuOpenId(null);
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className={cn(
                          "truncate text-[13px] leading-snug",
                          isActive ? "text-foreground" : "text-foreground/70"
                        )}>
                          {session.title}
                        </p>
                      </button>

                      {/* Actions menu trigger + popover */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(isMenuOpen ? null : session.id);
                          }}
                          className={cn(
                            "flex size-6 items-center justify-center rounded-md text-muted-foreground transition-all",
                            "opacity-0 group-hover:opacity-100",
                            isMenuOpen && "bg-accent opacity-100",
                            "hover:bg-accent hover:text-foreground"
                          )}
                        >
                          <MoreHorizontal className="size-3.5" />
                        </button>

                        {isMenuOpen && (
                          <>
                            {/* Backdrop */}
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setMenuOpenId(null)}
                            />
                            <div className="absolute right-0 top-7 z-20 w-36 overflow-hidden rounded-xl border border-border/60 bg-popover shadow-lg">
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  setRenamingId(session.id);
                                  setRenameValue(session.title);
                                }}
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-foreground hover:bg-accent"
                              >
                                <Pencil className="size-3.5 text-muted-foreground" />
                                Rename
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  setConfirmDeleteTitle(session.title);
                                  setConfirmDeleteId(session.id);
                                }}
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-destructive hover:bg-destructive/8"
                              >
                                <Trash2 className="size-3.5" />
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const isIdle = !thread && !activeSessionId;

  // Shared compose input content
  const composeInner = (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        title="Attach file"
        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
      >
        {isUploading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
      </button>
      <textarea
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          const el = event.target;
          el.style.height = "auto";
          el.style.height = Math.min(el.scrollHeight, 180) + "px";
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void handleSend("chat");
          }
        }}
        placeholder="Ask about meaning, request a translation, or dig into vocabulary…"
        rows={1}
        className="flex-1 resize-none bg-transparent text-[13px] leading-[1.6] outline-none placeholder:text-muted-foreground/60"
        style={{ minHeight: "24px", maxHeight: "180px" }}
        disabled={isSending}
      />
      <div className="flex shrink-0 items-center gap-1.5 pb-0.5">
        {!isIdle && !!thread?.uploads.length && (
          <div className="mr-1 text-[11px] text-muted-foreground/50">
            {thread.uploads.length} grounded
          </div>
        )}
        <button
          type="button"
          onClick={() => void handleSend("chat")}
          disabled={isSending || !draft.trim()}
          className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/85 disabled:opacity-35 disabled:cursor-not-allowed"
        >
          {isSending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
        </button>
      </div>
    </>
  );

  const rightPane = (
    <div className="relative flex h-full min-h-0 flex-col bg-background">
      {/* Header + messages: only when active, takes flex-1 */}
      {/* No AnimatePresence — unmounts immediately so layout animation starts at the same time */}
        {!isIdle && (
          <motion.div
            key="active-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {/* Header */}
            <div className="border-b border-border/40 px-5 py-3">
              <div className="flex items-center gap-3">
                {isMobile ? (
                  <button
                    type="button"
                    onClick={() => setShowMobileDetail(false)}
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">
                    {thread?.session.title || activeSession?.title || "Study Chat"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {thread
                      ? `${thread.uploads.length} upload${thread.uploads.length === 1 ? "" : "s"} grounded`
                      : "Upload study material, then ask for summaries, translations, or vocabulary help."}
                  </p>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-1.5">
                  {QUICK_ACTIONS.map(({ action, label, prompt, Icon }) => (
                    <button
                      key={action}
                      type="button"
                      disabled={isSending || isUploading || !thread?.uploads.length}
                      onClick={() => void handleSend(action, prompt)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150",
                        "border border-border/50 bg-background text-muted-foreground",
                        "hover:border-primary/40 hover:bg-primary/8 hover:text-primary",
                        "disabled:pointer-events-none disabled:opacity-35"
                      )}
                    >
                      <Icon className="size-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

              </div>

              {/* Upload chips */}
              {thread?.uploads.length ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {thread.uploads.map((upload) => {
                    const Icon = uploadIcon(upload);
                    return (
                      <div
                        key={upload.id}
                        className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-[11px] text-foreground/70"
                      >
                        <Icon className="size-3 shrink-0 text-primary/70" />
                        <span className="max-w-[160px] truncate">{uploadLabel(upload)}</span>
                        {upload.language_detected && (
                          <span className="text-muted-foreground/60">{upload.language_detected}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {/* Message area */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {thread?.messages.length ? (
                <div className="mx-auto flex max-w-3xl flex-col gap-10">
                  {thread.messages.map((message) => (
                    <div key={message.id} className="flex flex-col">
                      {message.role === "user" ? (
                        <div className="flex justify-end">
                          <div className="max-w-[86%] rounded-2xl bg-primary px-4 py-3 text-primary-foreground">
                            <p className="whitespace-pre-wrap text-[13px] leading-[1.65]">{message.body}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-[13px] leading-[1.65] text-foreground">{message.body}</p>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              ) : null}
            </div>
          </motion.div>
        )}

      {/* Motto: absolutely positioned so layout changes in the wrapper don't affect its exit position */}
      <AnimatePresence>
        {isIdle && (
          <motion.p
            key="motto"
            initial={{ opacity: 0, filter: "blur(8px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(8px)" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="pointer-events-none absolute inset-x-0 top-[calc(50%-80px)] text-center text-2xl font-semibold text-foreground"
          >
            What do you want to study today?
          </motion.p>
        )}
      </AnimatePresence>

      {/* Outer wrapper: plain div that instantly resizes — no animation on the container */}
      <div
        className={cn(
          isIdle
            ? "flex flex-1 items-center justify-center px-6"
            : "px-4 pb-6 pt-3"
        )}
      >
        <motion.div
          layout="position"
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          className="mx-auto w-full max-w-3xl"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-muted/20 px-3 py-2.5 transition-colors focus-within:border-primary/40 focus-within:bg-background">
            {composeInner}
          </div>
        </motion.div>
      </div>
    </div>
  );

  return (
    <div className={cn("flex h-full min-h-0 bg-background [&_button]:cursor-pointer", isMobile ? "flex-col" : "flex-row")}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_STUDY_UPLOADS}
        className="hidden"
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? []);
          void uploadStudyFiles(selected);
        }}
      />
      {isMobile ? (
        showMobileDetail && (thread || activeSessionId) ? (
          rightPane
        ) : (
          leftRail
        )
      ) : (
        <>
          <div className="w-[240px] shrink-0 border-r border-border/40">{leftRail}</div>
          <div className="min-w-0 flex-1">{rightPane}</div>
        </>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete session?</DialogTitle>
            <DialogDescription>
              &ldquo;{confirmDeleteTitle}&rdquo; will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmDeleteId(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => confirmDeleteId && void handleDelete(confirmDeleteId)}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
