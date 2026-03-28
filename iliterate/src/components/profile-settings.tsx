"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { AtSign, Sun, Moon, Monitor, TriangleAlert, ChevronsUpDown, Check, Pencil, Trash2, Loader2, Upload, ImageOff, ZoomIn, ZoomOut, RotateCcw, ArrowLeft, AlignCenterHorizontal, AlignCenterVertical, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import { useRefreshLocale, useT, T } from "@/lib/i18n/I18nProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

const LANGUAGES = [
  "Arabic",
  "Chinese (Simplified)",
  "Chinese (Traditional)",
  "English",
  "French",
  "German",
  "Hindi",
  "Italian",
  "Japanese",
  "Korean",
  "Portuguese",
  "Russian",
  "Spanish",
];

const MOTIVATIONS = [
  { id: "travel", labelKey: "profile.motivations.travel" },
  { id: "career", labelKey: "profile.motivations.career" },
  { id: "academic", labelKey: "profile.motivations.academic" },
  { id: "personal", labelKey: "profile.motivations.personal" },
  { id: "family", labelKey: "profile.motivations.family" },
  { id: "entertainment", labelKey: "profile.motivations.entertainment" },
];

const FORMALITY_LEVELS = [
  { value: "casual", labelKey: "profile.speechStyles.casual", descKey: "profile.speechStyles.casualDesc" },
  { value: "standard", labelKey: "profile.speechStyles.standard", descKey: "profile.speechStyles.standardDesc" },
  { value: "professional", labelKey: "profile.speechStyles.professional", descKey: "profile.speechStyles.professionalDesc" },
  { value: "academic", labelKey: "profile.speechStyles.academic", descKey: "profile.speechStyles.academicDesc" },
];

interface Profile {
  id: string;
  display_name: string | null;
  native_language: string;
  target_language: string;
  age_group: string | null;
  education_level: string | null;
  years_learning: number | null;
  learning_motivation: string[] | null;
  proficiency_level: string | null;
  speech_formality: string | null;
  ui_language: string | null;
  created_at: string;
  updated_at: string;
}

interface SocialProfile {
  id: string;
  username: string | null;
  display_name: string;
  avatar_seed: string | null;
  avatar_url: string | null;
  leaderboard_anonymous: boolean | null;
  created_at: string;
  updated_at: string;
}

interface ProfileSettingsProps {
  user: User;
  profile: Profile | null;
  socialProfile: SocialProfile | null;
}


async function getCroppedBlob(imageSrc: string, cropPixels: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  canvas.width = cropPixels.width;
  canvas.height = cropPixels.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    cropPixels.x, cropPixels.y,
    cropPixels.width, cropPixels.height,
    0, 0,
    cropPixels.width, cropPixels.height,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/jpeg", 0.92);
  });
}

// ── YearsPicker ───────────────────────────────────────────────────────────────

function YearsPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const num = Math.max(0, Math.min(50, parseInt(value) || 0));
  const prevNumRef = useRef(num);
  const [direction, setDirection] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const set = (next: number) => {
    if (disabled) return;
    const clamped = Math.max(0, Math.min(50, next));
    prevNumRef.current = num;
    setDirection(next >= num ? 1 : -1);
    onChange(String(clamped));
  };

  const commitDraft = () => {
    const parsed = parseInt(draft);
    if (!isNaN(parsed)) {
      const clamped = Math.max(0, Math.min(50, parsed));
      prevNumRef.current = num;
      setDirection(clamped >= num ? 1 : -1);
      onChange(String(clamped));
    } else {
      onChange(value);
    }
    setEditing(false);
  };

  const currentDigits = String(num).split("");
  const prevDigits = String(prevNumRef.current).split("");

  return (
    <div className="flex items-center gap-3">
      {/* Stacked chevrons */}
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => set(num + 1)}
          disabled={disabled || num >= 50}
          className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 cursor-pointer"
        >
          <ChevronUp className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => set(num - 1)}
          disabled={disabled || num <= 0}
          className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 cursor-pointer"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>

      {/* Digit display — click to edit */}
      <div
        className="relative flex cursor-text items-center text-5xl font-bold tabular-nums leading-none text-foreground"
        onClick={() => { if (!disabled) { setDraft(String(num)); setEditing(true); } }}
        onWheel={(e) => { e.preventDefault(); set(num + (e.deltaY < 0 ? 1 : -1)); }}
      >
        <div className={`flex ${editing ? "invisible" : ""}`}>
          {currentDigits.map((digit, i) => {
            const posFromRight = currentDigits.length - 1 - i;
            const prevIdx = prevDigits.length - 1 - posFromRight;
            const prevDigit = prevIdx >= 0 ? prevDigits[prevIdx] : null;
            const changed = prevDigit !== digit;

            return (
              <span
                key={`pos-${posFromRight}`}
                className="relative block h-[1em] w-[1ch] overflow-hidden"
              >
                {changed ? (
                  <AnimatePresence mode="popLayout" custom={direction}>
                    <motion.span
                      key={digit}
                      custom={direction}
                      variants={{
                        enter: (d: number) => ({ y: d > 0 ? "100%" : "-100%" }),
                        center: { y: "0%" },
                        exit: (d: number) => ({ y: d > 0 ? "-100%" : "100%" }),
                      }}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-0 flex items-center justify-center select-none"
                    >
                      {digit}
                    </motion.span>
                  </AnimatePresence>
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center select-none">
                    {digit}
                  </span>
                )}
              </span>
            );
          })}
        </div>

        {editing && (
          <input
            autoFocus
            type="number"
            min={0}
            max={50}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitDraft();
              if (e.key === "Escape") setEditing(false);
            }}
            className="absolute inset-0 bg-transparent text-left text-5xl font-bold tabular-nums text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        )}
      </div>


    </div>
  );
}

export function ProfileSettings({ user, profile, socialProfile }: ProfileSettingsProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const refreshLocale = useRefreshLocale();
  const t = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [isLoading, setIsLoading] = useState(false);

  // Store initial values to track changes
  const initialValues = useMemo(() => ({
    displayName:
      socialProfile?.display_name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "",
    targetLanguage: profile?.target_language || "",
    nativeLanguage: profile?.native_language || "",
    ageGroup: profile?.age_group || "",
    educationLevel: profile?.education_level || "",
    yearsLearning: profile?.years_learning?.toString() || "0",
    speechFormality: profile?.speech_formality || "standard",
    motivations: profile?.learning_motivation || [],
    leaderboardAnonymous: socialProfile?.leaderboard_anonymous ?? false,
    uiLanguage: profile?.ui_language || "native",
  }), [profile, socialProfile, user.email, user.user_metadata]);

  const [displayName, setDisplayName] = useState(initialValues.displayName);
  const [targetLanguage, setTargetLanguage] = useState(initialValues.targetLanguage);
  const [nativeLanguage, setNativeLanguage] = useState(initialValues.nativeLanguage);
  const [ageGroup, setAgeGroup] = useState(initialValues.ageGroup);
  const [educationLevel, setEducationLevel] = useState(initialValues.educationLevel);
  const [yearsLearning, setYearsLearning] = useState(initialValues.yearsLearning);
  const [speechFormality, setSpeechFormality] = useState(initialValues.speechFormality);
  const [motivations, setMotivations] = useState<string[]>(initialValues.motivations);
  const [leaderboardAnonymous, setLeaderboardAnonymous] = useState(initialValues.leaderboardAnonymous);
  const [uiLanguage, setUiLanguage] = useState(initialValues.uiLanguage);
  const [targetLangOpen, setTargetLangOpen] = useState(false);
  const [nativeLangOpen, setNativeLangOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(socialProfile?.avatar_url ?? null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Crop state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const handleCropApply = async () => {
    if (!cropSrc || !croppedAreaPixels) return;
    setIsUploadingAvatar(true);
    try {
      const blob = await getCroppedBlob(cropSrc, croppedAreaPixels);
      const formData = new FormData();
      formData.append("file", blob, "avatar.jpg");
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload.error || "Upload failed");
        return;
      }
      setAvatarUrl(payload.avatar_url);
      setCropSrc(null);
      setShowAvatarDialog(false);
      toast.success(t("profile.profileUpdated"));
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const handleAvatarRemove = async () => {
    setIsUploadingAvatar(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json();
        toast.error(payload.error || "Failed to remove picture");
        return;
      }
      setAvatarUrl(null);
      toast.success(t("profile.profileUpdated"));
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const avatarInitials = (displayName
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)) || "?";

  // Check if any values have changed
  const hasChanges = useMemo(() => {
    const motivationsChanged =
      motivations.length !== initialValues.motivations.length ||
      motivations.some((m) => !initialValues.motivations.includes(m));

    return (
      displayName !== initialValues.displayName ||
      targetLanguage !== initialValues.targetLanguage ||
      nativeLanguage !== initialValues.nativeLanguage ||
      ageGroup !== initialValues.ageGroup ||
      educationLevel !== initialValues.educationLevel ||
      yearsLearning !== initialValues.yearsLearning ||
      speechFormality !== initialValues.speechFormality ||
      leaderboardAnonymous !== initialValues.leaderboardAnonymous ||
      uiLanguage !== initialValues.uiLanguage ||
      motivationsChanged
    );
  }, [displayName, targetLanguage, nativeLanguage, ageGroup, educationLevel, yearsLearning, speechFormality, leaderboardAnonymous, uiLanguage, motivations, initialValues]);

  const handleReset = () => {
    setDisplayName(initialValues.displayName);
    setTargetLanguage(initialValues.targetLanguage);
    setNativeLanguage(initialValues.nativeLanguage);
    setAgeGroup(initialValues.ageGroup);
    setEducationLevel(initialValues.educationLevel);
    setYearsLearning(initialValues.yearsLearning);
    setSpeechFormality(initialValues.speechFormality);
    setMotivations(initialValues.motivations);
    setLeaderboardAnonymous(initialValues.leaderboardAnonymous);
    setUiLanguage(initialValues.uiLanguage);
  };

  const handleMotivationChange = (id: string, checked: boolean) => {
    setMotivations((prev) =>
      checked ? [...prev, id] : prev.filter((m) => m !== id)
    );
  };

  const handleSave = async () => {
    setIsLoading(true);

    try {
      const supabase = createClient();
      const trimmedDisplayName = displayName.trim();

      if (!trimmedDisplayName) {
        toast.error(t("profile.displayName") + " " + t("common.error"));
        return;
      }


      const socialResponse = await fetch("/api/social/public-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: trimmedDisplayName,
          leaderboardAnonymous,
        }),
      });

      const socialPayload = await socialResponse.json().catch(() => null);
      if (!socialResponse.ok) {
        toast.error(socialPayload?.error || "Failed to save social profile");
        return;
      }

      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: {
          full_name: trimmedDisplayName,
        },
      });

      if (authUpdateError) {
        toast.error(authUpdateError.message);
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName || null,
          target_language: targetLanguage,
          native_language: nativeLanguage,
          age_group: ageGroup,
          education_level: educationLevel,
          years_learning: parseInt(yearsLearning, 10),
          speech_formality: speechFormality,
          learning_motivation: motivations,
          ui_language: uiLanguage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        toast.error(updateError.message);
        return;
      }

      toast.success(t("profile.profileUpdated"));
      router.refresh();
      await refreshLocale();
    } catch (err) {
      console.error("Update error:", err);
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "delete my account") return;
    setIsDeleting(true);
    try {
      const response = await fetch("/api/account/delete", { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        toast.error(payload?.error || "Failed to delete account");
        return;
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

  const userName =
    socialProfile?.display_name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "";

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold"><T id="profile.welcome" values={{ name: userName }} /></h1>
        <p className="text-muted-foreground mt-1"><T id="profile.manageSettings" /></p>
      </div>

      {/* ── Account card with hero banner ── */}
      <Card className="overflow-hidden">
        <div className="px-6 pb-6 pt-4">
          {/* Avatar + identity row */}
          <div className="flex items-center gap-4 mb-2">
            {/* Avatar with hover-pencil overlay */}
            <div className="group relative shrink-0">
              <Avatar className="size-20 rounded-full shadow-sm border border-border">
                <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
                <AvatarFallback className="rounded-full bg-primary/10 text-2xl font-semibold text-primary">
                  {avatarInitials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => setShowAvatarDialog(true)}
                disabled={isUploadingAvatar}
                className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed"
                aria-label={t("profile.editPicture")}
              >
                {isUploadingAvatar
                  ? <Loader2 className="size-5 animate-spin text-white" />
                  : <Pencil className="size-5 text-white" />}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>

            {/* Name + username */}
            <div className="flex-1 min-w-0">
              <p className="truncate text-lg font-semibold leading-tight">
                {displayName || "—"}
              </p>
              {socialProfile?.username && (
                <p className="truncate text-sm text-muted-foreground">
                  @{socialProfile.username}
                </p>
              )}
            </div>

          </div>

          {/* Avatar edit dialog */}
          <div className="mb-6" />
          <Dialog
            open={showAvatarDialog}
            onOpenChange={(open) => {
              if (!open) handleCropCancel();
              setShowAvatarDialog(open);
            }}
          >
            <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
              <DialogHeader className="sr-only">
                <DialogTitle><T id="profile.profilePicture" /></DialogTitle>
                <DialogDescription><T id="profile.uploadPhoto" /></DialogDescription>
              </DialogHeader>

              <AnimatePresence mode="sync" initial={false}>
                  {cropSrc ? (
                    /* ── Crop editor view ── */
                    <motion.div
                      key="crop"
                      layoutId="avatar-dialog-panel"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                      style={{ originX: 0.5, originY: 0 }}
                    >
                      <div className="flex items-center px-4 py-3 border-b border-border">
                        <p className="text-sm font-medium"><T id="profile.adjustPhoto" /></p>
                        <p className="text-xs text-muted-foreground ml-3"><T id="profile.dragToReposition" /></p>
                      </div>

                      <div className="relative w-full" style={{ height: 360 }}>
                        <Cropper
                          image={cropSrc}
                          crop={crop}
                          zoom={zoom}
                          aspect={1}
                          cropShape="round"
                          showGrid={false}
                          onCropChange={setCrop}
                          onZoomChange={setZoom}
                          onCropComplete={onCropComplete}
                          style={{
                            containerStyle: { background: "hsl(var(--muted))" },
                            cropAreaStyle: {
                              border: "2px solid hsl(var(--primary))",
                              boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                              color: "hsl(var(--primary))",
                            },
                          }}
                        />
                      </div>

                      <div className="flex items-center gap-4 px-6 py-4 border-t border-border">
                        <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 0.1))} className="text-muted-foreground hover:text-primary transition-colors">
                          <ZoomOut className="size-5" />
                        </button>
                        <Slider min={1} max={3} step={0.01} value={[zoom]} onValueChange={([v]) => setZoom(v)} className="flex-1" />
                        <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.1))} className="text-muted-foreground hover:text-primary transition-colors">
                          <ZoomIn className="size-5" />
                        </button>
                        <div className="flex items-center gap-2 border-l border-border pl-4 ml-1">
                          <button type="button" onClick={() => setCrop((c) => ({ ...c, x: 0 }))} className="text-muted-foreground hover:text-primary transition-colors" title="Center horizontally">
                            <AlignCenterHorizontal className="size-5" />
                          </button>
                          <button type="button" onClick={() => setCrop((c) => ({ ...c, y: 0 }))} className="text-muted-foreground hover:text-primary transition-colors" title="Center vertically">
                            <AlignCenterVertical className="size-5" />
                          </button>
                          <button type="button" onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); }} className="text-muted-foreground hover:text-primary transition-colors" title="Reset all">
                            <RotateCcw className="size-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-3 px-6 pt-1 pb-5">
                        <Button type="button" variant="outline" size="lg" className="flex-1 gap-2 border-border hover:bg-muted" disabled={isUploadingAvatar} onClick={handleCropCancel}>
                          <ArrowLeft className="size-4" />
                          <T id="common.back" />
                        </Button>
                        <Button type="button" size="lg" className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium" disabled={isUploadingAvatar} onClick={handleCropApply}>
                          {isUploadingAvatar ? <><Loader2 className="size-4 animate-spin" /> <T id="profile.saving" /></> : <T id="profile.apply" />}
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    /* ── Default view ── */
                    <motion.div
                      key="upload"
                      layoutId="avatar-dialog-panel"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                      style={{ originX: 0.5, originY: 0 }}
                    >
                      <div className="flex items-center px-4 py-3 border-b border-border">
                        <p className="text-sm font-medium"><T id="profile.profilePicture" /></p>
                      </div>

                      <div className="flex w-full flex-col items-center justify-center gap-3 py-10" style={{ minHeight: 280 }}>
                        <Avatar className="size-52 rounded-full border border-border">
                          <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
                          <AvatarFallback className="rounded-full bg-primary/10 text-6xl font-semibold text-primary">
                            {avatarInitials}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      <div className="flex items-center justify-center gap-3 px-6 pb-4">
                        {avatarUrl && (
                          <Button type="button" variant="outline" size="sm" disabled={isUploadingAvatar}
                            onClick={async () => { await handleAvatarRemove(); setShowAvatarDialog(false); }}
                            className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
                            <ImageOff className="size-3.5" />
                            <T id="common.remove" />
                          </Button>
                        )}
                        <Button type="button" variant="outline" size="sm" disabled={isUploadingAvatar} onClick={() => avatarInputRef.current?.click()} className="gap-2">
                          {isUploadingAvatar
                            ? <><Loader2 className="size-3.5 animate-spin" /> <T id="profile.uploading" /></>
                            : <><Upload className="size-3.5" /> <T id="profile.uploadPhoto" /></>}
                        </Button>
                      </div>

                      <div className="border-t border-border px-4 py-3 flex items-center justify-center">
                        <p className="text-[11px] text-muted-foreground/60 tracking-wide uppercase">
                          JPG · PNG · WebP · GIF · Max 5 MB
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
            </DialogContent>
          </Dialog>

          {/* Fields */}
          <div className="space-y-4">
            <Field>
              <FieldLabel><T id="profile.displayName" /></FieldLabel>
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                disabled={isLoading}
              />
              <FieldDescription>
                <T id="profile.displayNameDesc" />
              </FieldDescription>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel><T id="profile.username" /></FieldLabel>
                <div className="relative">
                  <AtSign className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={socialProfile?.username || ""}
                    className="pl-9"
                    disabled
                  />
                </div>
                <FieldDescription><T id="profile.usernameReadOnly" /></FieldDescription>
              </Field>
              <Field>
                <FieldLabel><T id="profile.email" /></FieldLabel>
                <Input value={user.email || ""} disabled />
                <FieldDescription><T id="profile.emailReadOnly" /></FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel><T id="profile.memberSince" /></FieldLabel>
              <Input
                value={new Date(profile?.created_at || user.created_at).toLocaleDateString(
                  "en-US",
                  { year: "numeric", month: "long", day: "numeric" }
                )}
                disabled
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle><T id="profile.learningPreferences" /></CardTitle>
          <CardDescription>
            <T id="profile.learningPreferencesDesc" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel><T id="profile.targetLanguage" /></FieldLabel>
              <Popover open={targetLangOpen} onOpenChange={setTargetLangOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={targetLangOpen}
                    disabled={isLoading}
                    className="w-full justify-between font-normal cursor-pointer"
                  >
                    {targetLanguage
                      ? LANGUAGES.find((l) => l.toLowerCase() === targetLanguage) ?? targetLanguage
                      : t("profile.selectLanguage")}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder={t("profile.searchLanguages")} />
                    <CommandList>
                      <CommandEmpty>{t("common.error")}</CommandEmpty>
                      <CommandGroup>
                        {LANGUAGES.map((lang) => (
                          <CommandItem
                            key={lang}
                            value={lang}
                            onSelect={() => {
                              setTargetLanguage(lang.toLowerCase());
                              setTargetLangOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", targetLanguage === lang.toLowerCase() ? "opacity-100" : "opacity-0")} />
                            {lang}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <FieldDescription><T id="profile.targetLanguageDesc" /></FieldDescription>
            </Field>

            <Field>
              <FieldLabel><T id="profile.nativeLanguage" /></FieldLabel>
              <Popover open={nativeLangOpen} onOpenChange={setNativeLangOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={nativeLangOpen}
                    disabled={isLoading}
                    className="w-full justify-between font-normal cursor-pointer"
                  >
                    {nativeLanguage
                      ? LANGUAGES.find((l) => l.toLowerCase() === nativeLanguage) ?? nativeLanguage
                      : t("profile.selectNativeLanguage")}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder={t("profile.searchLanguages")} />
                    <CommandList>
                      <CommandEmpty>{t("common.error")}</CommandEmpty>
                      <CommandGroup>
                        {LANGUAGES.map((lang) => (
                          <CommandItem
                            key={lang}
                            value={lang}
                            onSelect={() => {
                              setNativeLanguage(lang.toLowerCase());
                              setNativeLangOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", nativeLanguage === lang.toLowerCase() ? "opacity-100" : "opacity-0")} />
                            {lang}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </Field>

            <Field className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel><T id="profile.ageGroup" /></FieldLabel>
                <Select
                  value={ageGroup}
                  onValueChange={setAgeGroup}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("common.loading")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="child">{t("profile.ageGroups.child")}</SelectItem>
                    <SelectItem value="teen">{t("profile.ageGroups.teen")}</SelectItem>
                    <SelectItem value="adult">{t("profile.ageGroups.adult")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel><T id="profile.educationLevel" /></FieldLabel>
                <Select
                  value={educationLevel}
                  onValueChange={setEducationLevel}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elementary">{t("profile.educationLevels.elementary")}</SelectItem>
                    <SelectItem value="middle">{t("profile.educationLevels.middle")}</SelectItem>
                    <SelectItem value="high">{t("profile.educationLevels.high")}</SelectItem>
                    <SelectItem value="college">{t("profile.educationLevels.college")}</SelectItem>
                    <SelectItem value="graduate">{t("profile.educationLevels.graduate")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </Field>

            <Field>
              <FieldLabel><T id="profile.yearsOfStudy" /></FieldLabel>
              <YearsPicker
                value={yearsLearning}
                onChange={setYearsLearning}
                disabled={isLoading}
              />
            </Field>

            <Field>
              <FieldLabel><T id="profile.speechStyle" /></FieldLabel>
              <Select
                value={speechFormality}
                onValueChange={setSpeechFormality}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select speech style" />
                </SelectTrigger>
                <SelectContent>
                  {FORMALITY_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      <span className="font-medium">{t(level.labelKey)}</span>
                      <span className="text-muted-foreground"> — {t(level.descKey)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                <T id="profile.speechStyleDesc" />
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel><T id="profile.interfaceLanguage" /></FieldLabel>
              <FieldDescription>
                <T id="profile.interfaceLanguageDesc" />
              </FieldDescription>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUiLanguage("native")}
                  disabled={isLoading}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-4 transition-all hover:bg-accent cursor-pointer ${
                    uiLanguage === "native" ? "border-primary bg-accent" : "border-border"
                  }`}
                >
                  <span className="text-sm font-medium"><T id="profile.nativeLangOption" /></span>
                  <span className="text-xs text-muted-foreground"><T id="profile.nativeLangOptionDesc" /></span>
                </button>
                <button
                  type="button"
                  onClick={() => setUiLanguage("target")}
                  disabled={isLoading}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-4 transition-all hover:bg-accent cursor-pointer ${
                    uiLanguage === "target" ? "border-primary bg-accent" : "border-border"
                  }`}
                >
                  <span className="text-sm font-medium"><T id="profile.targetLangOption" /></span>
                  <span className="text-xs text-muted-foreground"><T id="profile.targetLangOptionDesc" /></span>
                </button>
              </div>
            </Field>

            <Field>
              <FieldLabel><T id="profile.learningMotivations" /></FieldLabel>
              <FieldDescription><T id="profile.learningMotivationsDesc" /></FieldDescription>
              <div className="grid grid-cols-2 gap-3 pt-1">
                {MOTIVATIONS.map((motivation) => (
                  <label
                    key={motivation.id}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={motivations.includes(motivation.id)}
                      onCheckedChange={(checked) =>
                        handleMotivationChange(motivation.id, checked === true)
                      }
                      disabled={isLoading}
                    />
                    <T id={motivation.labelKey} />
                  </label>
                ))}
              </div>
            </Field>

          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle><T id="profile.privacy" /></CardTitle>
          <CardDescription><T id="profile.privacyDesc" /></CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={leaderboardAnonymous}
              onCheckedChange={(checked) => setLeaderboardAnonymous(checked === true)}
              disabled={isLoading}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium leading-none"><T id="profile.hideLeaderboard" /></p>
              <p className="text-sm text-muted-foreground mt-1">
                <T id="profile.hideLeaderboardDesc" />
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle><T id="profile.themePreferences" /></CardTitle>
          <CardDescription>
            <T id="profile.themePreferencesDesc" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldLabel><T id="profile.theme" /></FieldLabel>
            <FieldDescription>
              <T id="profile.themeDesc" />
            </FieldDescription>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <button
                onClick={() => setTheme("light")}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:bg-accent cursor-pointer ${
                  mounted && theme === "light"
                    ? "border-primary bg-accent"
                    : "border-border"
                }`}
              >
                <Sun className="size-6" />
                <span className="text-sm font-medium"><T id="profile.themeLight" /></span>
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:bg-accent cursor-pointer ${
                  mounted && theme === "dark"
                    ? "border-primary bg-accent"
                    : "border-border"
                }`}
              >
                <Moon className="size-6" />
                <span className="text-sm font-medium"><T id="profile.themeDark" /></span>
              </button>
              <button
                onClick={() => setTheme("system")}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:bg-accent cursor-pointer ${
                  mounted && theme === "system"
                    ? "border-primary bg-accent"
                    : "border-border"
                }`}
              >
                <Monitor className="size-6" />
                <span className="text-sm font-medium"><T id="profile.themeSystem" /></span>
              </button>
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <TriangleAlert className="size-5" />
            <T id="profile.dangerZone" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium"><T id="profile.deleteAccount" /></p>
                <p className="text-sm text-muted-foreground">
                  <T id="profile.deleteAccountDesc" />
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                className="shrink-0"
              >
                <T id="profile.deleteAccount" />
              </Button>
            </div>
          </div>

          <Dialog
            open={showDeleteConfirm}
            onOpenChange={(open) => {
              if (!open) {
                setShowDeleteConfirm(false);
                setDeleteConfirmText("");
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-destructive"><T id="profile.deleteAccount" /></DialogTitle>
                <DialogDescription>
                  <T id="profile.deleteAccountDesc" />
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Type <span className="font-bold text-white">&quot;delete my account&quot;</span> to confirm.
                </p>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="delete my account"
                  disabled={isDeleting}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                  }}
                  disabled={isDeleting}
                >
                  <T id="common.cancel" />
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== "delete my account" || isDeleting}
                >
                  {isDeleting ? <T id="profile.deleting" /> : <T id="profile.permanentlyDelete" />}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-lg">
              <p className="text-sm text-muted-foreground"><T id="profile.unsavedChanges" /></p>
              <Button variant="outline" onClick={handleReset} disabled={isLoading} size="sm">
                <T id="profile.discard" />
              </Button>
              <Button onClick={handleSave} disabled={isLoading} size="sm">
                {isLoading ? <T id="profile.saving" /> : <T id="profile.saveChanges" />}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
