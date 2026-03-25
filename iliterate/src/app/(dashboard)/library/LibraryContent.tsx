"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { BookOpen, Loader2, Award, Bookmark, X, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { motion } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Content } from "@/types/database";
import { ImportContentDialog } from "@/components/library/ImportContentDialog";

interface BookmarkWithMetadata {
  id: string;
  item_type: "content" | "lesson";
  item_id: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface LibraryContentProps {
  contents: Content[];
  targetLanguage: string | null;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
};

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

function formatLanguage(code: string): string {
  return LANGUAGE_NAMES[code.toLowerCase()] ?? code.charAt(0).toUpperCase() + code.slice(1);
}

function toggle(set: string[], value: string): string[] {
  return set.includes(value) ? set.filter((v) => v !== value) : [...set, value];
}

function FilterSection({
  title,
  options,
  selected,
  onToggle,
  formatOption,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  formatOption?: (value: string) => string;
}) {
  if (options.length === 0) return null;
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          {title}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20 dark:bg-primary/15 dark:text-primary dark:border-primary/50 dark:shadow-none dark:backdrop-blur-sm"
                  : "border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {formatOption ? formatOption(opt) : opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LibraryContent({ contents, targetLanguage }: LibraryContentProps) {
  const languages = Array.from(new Set(contents.map((c) => c.language))).sort();
  const difficulties = CEFR_ORDER.filter((l) =>
    contents.some((c) => c.difficulty_level === l)
  );
  const types = Array.from(
    new Set(contents.map((c) => c.content_type).filter(Boolean) as string[])
  ).sort();

  const [activeTab, setActiveTab] = useState<"browse" | "my-content">("browse");
  const [savedOnly, setSavedOnly] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const [bookmarks, setBookmarks] = useState<BookmarkWithMetadata[]>([]);
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false);
  const [hasLoadedBookmarks, setHasLoadedBookmarks] = useState(false);

  // My Content state (lifted here so filter panel can access it)
  const [userContent, setUserContent] = useState<UserContent[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [myContentSelectedLanguages, setMyContentSelectedLanguages] = useState<string[]>([]);
  const [myContentSelectedDifficulties, setMyContentSelectedDifficulties] = useState<string[]>([]);

  useEffect(() => {
    setIsLoadingContent(true);
    fetch("/api/content/upload")
      .then((r) => (r.ok ? r.json() : []))
      .then(setUserContent)
      .catch(() => setUserContent([]))
      .finally(() => setIsLoadingContent(false));
  }, [refreshKey]);

  const myContentLanguages = Array.from(new Set(userContent.map((c) => c.language))).sort();
  const myContentDifficulties = CEFR_ORDER.filter((l) =>
    userContent.some((c) => c.difficulty_level === l)
  );
  const filteredUserContent = userContent.filter((c) => {
    if (myContentSelectedLanguages.length > 0 && !myContentSelectedLanguages.includes(c.language)) return false;
    if (myContentSelectedDifficulties.length > 0 && !myContentSelectedDifficulties.includes(c.difficulty_level)) return false;
    return true;
  });
  const myContentHasActiveFilters =
    myContentSelectedLanguages.length > 0 || myContentSelectedDifficulties.length > 0;

  const handleUpdateUserContent = (id: string, updates: Partial<UserContent>) => {
    setUserContent((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };
  const handleDeleteUserContent = (id: string) => {
    setUserContent((prev) => prev.filter((c) => c.id !== id));
  };

  const loadBookmarks = useCallback(async () => {
    if (hasLoadedBookmarks) return;
    setIsLoadingBookmarks(true);
    try {
      const res = await fetch("/api/bookmarks");
      if (res.ok) setBookmarks(await res.json());
    } catch {
      // Silently fail
    } finally {
      setIsLoadingBookmarks(false);
      setHasLoadedBookmarks(true);
    }
  }, [hasLoadedBookmarks]);

  const handleSavedToggle = () => {
    const next = !savedOnly;
    setSavedOnly(next);
    if (next) loadBookmarks();
  };

  const filteredContents = contents.filter((c) => {
    if (selectedLanguages.length > 0 && !selectedLanguages.includes(c.language)) return false;
    if (selectedDifficulties.length > 0 && !selectedDifficulties.includes(c.difficulty_level)) return false;
    if (selectedTypes.length > 0 && (!c.content_type || !selectedTypes.includes(c.content_type))) return false;
    return true;
  });

  const hasActiveFilters =
    selectedLanguages.length > 0 || selectedDifficulties.length > 0 || selectedTypes.length > 0;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main content — scrolls independently */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-10 shrink-0 items-center px-4 pt-4">
          <SidebarTrigger className="-ml-1 size-7 text-muted-foreground md:hidden" />
        </div>
        <div className="flex-1 overflow-y-auto px-8 pb-10">
          <div className="mb-6 flex flex-col gap-4 pt-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Library</h1>
              <p className="mt-1 text-sm text-muted-foreground">Browse content by language.</p>
            </div>
          </div>

          {/* Tab pills with sliding indicator */}
          <div className="mb-6 inline-flex rounded-lg bg-muted p-[3px]">
            {(["browse", "my-content"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-3 py-1 text-sm font-medium transition-colors duration-150 ${
                  activeTab === tab ? "text-primary-foreground dark:text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-md bg-primary dark:bg-primary/20 shadow-sm"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                  />
                )}
                <span className="relative z-10">
                  {tab === "browse" ? "Browse" : "My Content"}
                </span>
              </button>
            ))}
          </div>

          {/* Tab content — instant switch */}
          {activeTab === "browse" ? (
            savedOnly ? (
              <SavedGrid bookmarks={bookmarks} isLoading={isLoadingBookmarks} />
            ) : filteredContents.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No content matches the selected filters.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredContents.map((content) => (
                  <ContentCard key={content.id} content={content} />
                ))}
              </div>
            )
          ) : (
            <MyContentTab
              targetLanguage={targetLanguage}
              userContent={filteredUserContent}
              isLoadingContent={isLoadingContent}
              onRefresh={() => setRefreshKey((k) => k + 1)}
              onUpdateItem={handleUpdateUserContent}
              onDeleteItem={handleDeleteUserContent}
            />
          )}
        </div>
      </div>

      {/* Right filter panel */}
      <aside className="w-56 shrink-0 overflow-y-auto border-l border-sidebar-border bg-sidebar px-4 py-6">
        {activeTab === "browse" ? (
          <>
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                Filters
              </p>
              <button
                onClick={() => {
                  setSelectedLanguages([]);
                  setSelectedDifficulties([]);
                  setSelectedTypes([]);
                }}
                className={`cursor-pointer flex items-center gap-1 rounded-full border border-border/40 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive ${
                  hasActiveFilters && !savedOnly ? "visible" : "invisible pointer-events-none"
                }`}
              >
                <X className="h-2.5 w-2.5" />
                Clear
              </button>
            </div>

            <div className="space-y-5">
              <button
                onClick={handleSavedToggle}
                className={`cursor-pointer inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                  savedOnly
                    ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <Bookmark className={`h-3 w-3 transition-all ${savedOnly ? "fill-primary-foreground" : ""}`} />
                Saved
              </button>

              <div className={`space-y-5 transition-opacity duration-150 ${savedOnly ? "pointer-events-none opacity-30" : ""}`}>
                <FilterSection
                  title="Language"
                  options={languages}
                  selected={selectedLanguages}
                  onToggle={(v) => setSelectedLanguages(toggle(selectedLanguages, v))}
                  formatOption={formatLanguage}
                />
                <FilterSection
                  title="Difficulty"
                  options={difficulties}
                  selected={selectedDifficulties}
                  onToggle={(v) => setSelectedDifficulties(toggle(selectedDifficulties, v))}
                />
                <FilterSection
                  title="Type"
                  options={types}
                  selected={selectedTypes}
                  onToggle={(v) => setSelectedTypes(toggle(selectedTypes, v))}
                  formatOption={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                Filters
              </p>
              <button
                onClick={() => {
                  setMyContentSelectedLanguages([]);
                  setMyContentSelectedDifficulties([]);
                }}
                className={`cursor-pointer flex items-center gap-1 rounded-full border border-border/40 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive ${
                  myContentHasActiveFilters ? "visible" : "invisible pointer-events-none"
                }`}
              >
                <X className="h-2.5 w-2.5" />
                Clear
              </button>
            </div>

            <div className="space-y-5">
              <FilterSection
                title="Language"
                options={myContentLanguages}
                selected={myContentSelectedLanguages}
                onToggle={(v) => setMyContentSelectedLanguages(toggle(myContentSelectedLanguages, v))}
                formatOption={formatLanguage}
              />
              <FilterSection
                title="Difficulty"
                options={myContentDifficulties}
                selected={myContentSelectedDifficulties}
                onToggle={(v) => setMyContentSelectedDifficulties(toggle(myContentSelectedDifficulties, v))}
              />
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

type UserContent = {
  id: string;
  title: string;
  language: string;
  difficulty_level: string;
  word_count: number | null;
  estimated_reading_time: number | null;
  created_at: string;
  source_upload_kind?: string | null;
  thumbnail_url?: string | null;
};

function MyContentTab({
  targetLanguage,
  userContent,
  isLoadingContent,
  onRefresh,
  onUpdateItem,
  onDeleteItem,
}: {
  targetLanguage: string | null;
  userContent: UserContent[];
  isLoadingContent: boolean;
  onRefresh: () => void;
  onUpdateItem: (id: string, updates: Partial<UserContent>) => void;
  onDeleteItem: (id: string) => void;
}) {
  const [editingItem, setEditingItem] = useState<UserContent | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editLanguage, setEditLanguage] = useState("");
  const [editDifficulty, setEditDifficulty] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openEdit = (item: UserContent) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditLanguage(item.language);
    setEditDifficulty(item.difficulty_level);
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setIsSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/content/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          language: editLanguage,
          difficulty_level: editDifficulty,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      onUpdateItem(editingItem.id, data);
      setEditingItem(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/content/${deletingId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete");
      }
      onDeleteItem(deletingId);
      setDeletingId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <ImportContentDialog
        targetLanguage={targetLanguage}
        onImported={() => {
          onRefresh();
        }}
      />

      {/* User's uploaded content list */}
      {isLoadingContent ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : userContent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <BookOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No content yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Import a PDF, photo, or website to start reading.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {userContent.map((item) => (
            <Card key={item.id} className="flex flex-col">
              {item.source_upload_kind === "image" && item.thumbnail_url ? (
                <div className="relative aspect-[4/3] overflow-hidden rounded-t-xl border-b border-border/60 bg-muted/20">
                  <Image
                    src={item.thumbnail_url}
                    alt={item.title}
                    fill
                    unoptimized
                    className="object-cover object-top"
                  />
                </div>
              ) : null}
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{item.title}</CardTitle>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem className="cursor-pointer" onClick={() => openEdit(item)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => { setDeletingId(item.id); setDeleteError(null); }}
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <CardDescription className="flex items-center gap-2">
                  <span>{formatLanguage(item.language)}</span>
                  <span>•</span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">{item.difficulty_level}</span>
                  {item.estimated_reading_time && (
                    <>
                      <span>•</span>
                      <span>{item.estimated_reading_time} min read</span>
                    </>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-end">
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/reader/${item.id}`}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Read
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => { if (!open) setEditingItem(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              Edit content
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Title</label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Language</label>
                <select
                  value={editLanguage}
                  onChange={(e) => setEditLanguage(e.target.value)}
                  className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
                >
                  {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Difficulty</label>
                <select
                  value={editDifficulty}
                  onChange={(e) => setEditDifficulty(e.target.value)}
                  className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
                >
                  {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            {editError && <p className="text-xs text-destructive">{editError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setEditingItem(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={isSavingEdit || !editTitle.trim()}
              >
                {isSavingEdit ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Remove content
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              This will permanently remove the item from your library. This cannot be undone.
            </p>
            {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeletingId(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                Remove
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContentCard({ content }: { content: Content }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{content.title}</CardTitle>
          <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            {content.difficulty_level}
          </span>
        </div>
        <CardDescription className="flex items-center gap-2">
          <span>{formatLanguage(content.language)}</span>
          <span>•</span>
          <span>{content.content_type}</span>
          {content.estimated_reading_time && (
            <>
              <span>•</span>
              <span>{content.estimated_reading_time} min read</span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end">
        {content.topic_tags && content.topic_tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1">
            {content.topic_tags.map((tag: string) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <Button asChild variant="outline" className="w-full">
          <Link href={`/reader/${content.id}`}>
            <BookOpen className="mr-2 h-4 w-4" />
            Read
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function SavedGrid({
  bookmarks,
  isLoading,
}: {
  bookmarks: BookmarkWithMetadata[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Bookmark content while reading to save it here.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {bookmarks.map((bookmark) =>
        bookmark.item_type === "content" ? (
          <SavedContentCard key={bookmark.id} bookmark={bookmark} />
        ) : (
          <SavedLessonCard key={bookmark.id} bookmark={bookmark} />
        )
      )}
    </div>
  );
}

function SavedContentCard({ bookmark }: { bookmark: BookmarkWithMetadata }) {
  const m = bookmark.metadata;
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{m.title as string}</CardTitle>
          <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            {m.difficulty_level as string}
          </span>
        </div>
        <CardDescription className="flex items-center gap-2">
          <span>{formatLanguage(m.language as string)}</span>
          <span>•</span>
          <span>{m.content_type as string}</span>
          {Number(m.estimated_reading_time) > 0 && (
            <>
              <span>•</span>
              <span>{Number(m.estimated_reading_time)} min read</span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end">
        {Array.isArray(m.topic_tags) && m.topic_tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1">
            {(m.topic_tags as string[]).map((tag: string) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <Button asChild className="w-full">
          <Link href={`/reader/${bookmark.item_id}`}>
            <BookOpen className="mr-2 h-4 w-4" />
            Read
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function SavedLessonCard({ bookmark }: { bookmark: BookmarkWithMetadata }) {
  const m = bookmark.metadata;
  const topic = m.topic as { name?: string; icon?: string } | null;
  const hasQuizScore = m.quiz_score != null && m.quiz_max_score != null;
  const quizPercentage = hasQuizScore
    ? Math.round(((m.quiz_score as number) / (m.quiz_max_score as number)) * 100)
    : null;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{m.title as string}</CardTitle>
          {Number(m.target_level) > 0 && (
            <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              Level {Number(m.target_level)}
            </span>
          )}
        </div>
        <CardDescription className="flex items-center gap-2">
          {topic && (
            <>
              <span>{String(topic.icon)} {String(topic.name)}</span>
              <span>•</span>
            </>
          )}
          {Number(m.word_count) > 0 && <span>{Number(m.word_count)} words</span>}
          {String(m.status) === "completed" && hasQuizScore && (
            <>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Award className="h-3 w-3" />
                {quizPercentage}%
              </span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end">
        <Button asChild className="w-full">
          <Link href={`/lesson-plan/${bookmark.item_id}`}>
            <BookOpen className="mr-2 h-4 w-4" />
            {String(m.status) === "completed" ? "Re-Read" : "Continue"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
