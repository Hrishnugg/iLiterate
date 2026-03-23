"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  FileImage,
  FileText,
  Languages,
  Loader2,
  MessageSquarePlus,
  NotebookPen,
  Send,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

        setActiveSessionId((current) => current ?? payload.sessions[0]!.id);
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

  async function handleNewSession() {
    try {
      await createSession();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create study chat");
    }
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

  const leftRail = (
    <div className="flex h-full min-h-0 flex-col bg-sidebar/60">
      <div className="border-b border-border/60 px-4 py-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1 size-8 text-muted-foreground md:hidden" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Study Chat</p>
            <p className="text-xs text-muted-foreground">
              Grounded AI help for PDFs, docs, and photos
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="ml-auto h-8"
            onClick={() => void handleNewSession()}
          >
            <MessageSquarePlus className="size-4" />
            New
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
          </Button>
        </div>
        <div className="mt-3 rounded-xl border border-border/50 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
          Native: <span className="font-medium text-foreground">{viewerLanguages.nativeLanguage}</span>
          {" · "}
          Target: <span className="font-medium text-foreground">{viewerLanguages.targetLanguage}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loadingSessions ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading sessions…
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/70 p-5 text-sm text-muted-foreground">
            Upload something to start a grounded study thread.
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => {
                  setActiveSessionId(session.id);
                  setShowMobileDetail(true);
                }}
                className={cn(
                  "w-full rounded-2xl border px-4 py-3 text-left transition-colors",
                  activeSessionId === session.id
                    ? "border-primary/30 bg-primary/[0.06]"
                    : "border-border/60 bg-background/80 hover:border-primary/20 hover:bg-accent/60"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{session.title}</p>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {session.latest_message || "No messages yet"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{session.upload_count} uploads</span>
                      <span>{session.message_count} messages</span>
                      <span>{relativeTime(session.updated_at)}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const rightPane = (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-3">
          {isMobile ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setShowMobileDetail(false)}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {thread?.session.title || activeSession?.title || "Study Chat"}
            </p>
            <p className="text-xs text-muted-foreground">
              {thread
                ? `${thread.uploads.length} uploads grounded in this thread`
                : "Upload study material, then ask for summaries, translations, or vocabulary help."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Add materials
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(({ action, label, prompt, Icon }) => (
            <Button
              key={action}
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={isSending || isUploading || !thread?.uploads.length}
              onClick={() => void handleSend(action, prompt)}
            >
              <Icon className="size-4" />
              {label}
            </Button>
          ))}
        </div>

        {thread?.uploads.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {thread.uploads.map((upload) => {
              const Icon = uploadIcon(upload);
              return (
                <div
                  key={upload.id}
                  className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-foreground"
                >
                  <Icon className="size-3.5 text-primary" />
                  <span className="max-w-[220px] truncate">{uploadLabel(upload)}</span>
                  <span className="text-muted-foreground">
                    {upload.language_detected || upload.kind}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {loadingThread ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading thread…
          </div>
        ) : thread ? (
          thread.messages.length > 0 ? (
            <div className="mx-auto flex max-w-4xl flex-col gap-4">
              {thread.messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex flex-col",
                    message.role === "user" ? "items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[88%] rounded-2xl px-4 py-3 shadow-sm",
                      messageBubbleTone(message)
                    )}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                  </div>
                  <p className="mt-1 px-1 text-[11px] text-muted-foreground">
                    {message.role === "user" ? "You" : "Study Chat"} · {relativeTime(message.created_at)}
                  </p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-muted/20 px-8 py-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-6" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">Ground your next question</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload a document or photo, then ask for a summary, translation, vocabulary help,
                or a follow-up explanation tied to the extracted text.
              </p>
            </div>
          )
        ) : (
          <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-muted/20 px-8 py-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageSquarePlus className="size-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Start a study chat</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a session, upload a PDF, DOCX, or image, and I’ll keep the conversation
              grounded in the extracted material.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button type="button" onClick={() => void handleNewSession()}>
                <MessageSquarePlus className="size-4" />
                New session
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" />
                Upload materials
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border/60 bg-background/95 px-5 py-4">
        <div className="mx-auto max-w-4xl">
          <label className="mb-2 block text-xs font-medium text-muted-foreground">
            Ask a follow-up grounded in this material
          </label>
          <div className="rounded-3xl border border-border/70 bg-muted/25 p-3 shadow-sm">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about meaning, summarize a section, request a translation, or dig into vocabulary."
              className="min-h-[96px] w-full resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-muted-foreground"
              disabled={isSending}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {thread?.uploads.length
                  ? `Grounded in ${thread.uploads.length} upload${thread.uploads.length === 1 ? "" : "s"}`
                  : "Upload material to ground the response"}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Attach
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-9"
                  onClick={() => void handleSend("chat")}
                  disabled={isSending || !draft.trim()}
                >
                  {isSending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn("flex h-full min-h-0 bg-background", isMobile ? "flex-col" : "flex-row")}>
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
          <div className="w-[360px] shrink-0 border-r border-border/60">{leftRail}</div>
          <div className="min-w-0 flex-1">{rightPane}</div>
        </>
      )}
    </div>
  );
}
