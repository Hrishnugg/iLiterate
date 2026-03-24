"use client";

import { useState, useMemo, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { AtSign, Sun, Moon, Monitor, TriangleAlert, ChevronsUpDown, Check } from "lucide-react";
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
import { useRefreshLocale } from "@/lib/i18n/I18nProvider";

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
  { id: "travel", label: "Travel" },
  { id: "career", label: "Career advancement" },
  { id: "academic", label: "Academic study" },
  { id: "personal", label: "Personal interest" },
  { id: "family", label: "Family / Heritage" },
  { id: "entertainment", label: "Entertainment (movies, music, etc.)" },
];

const FORMALITY_LEVELS = [
  { value: "casual", label: "Casual", description: "Informal speech for friends & family" },
  { value: "standard", label: "Standard", description: "Neutral, everyday communication" },
  { value: "professional", label: "Professional", description: "Business and work contexts" },
  { value: "academic", label: "Academic", description: "Scholarly, precise language" },
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
  leaderboard_anonymous: boolean | null;
  created_at: string;
  updated_at: string;
}

interface ProfileSettingsProps {
  user: User;
  profile: Profile | null;
  socialProfile: SocialProfile | null;
}


export function ProfileSettings({ user, profile, socialProfile }: ProfileSettingsProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const refreshLocale = useRefreshLocale();
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
        toast.error("Display name is required.");
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

      toast.success("Profile updated");
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel>Display name</FieldLabel>
            <Input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              disabled={isLoading}
            />
            <FieldDescription>
              This name appears in your social workspace and profile greeting.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Username</FieldLabel>
            <div className="relative">
              <AtSign className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={socialProfile?.username || ""}
                className="pl-9"
                disabled
              />
            </div>
            <FieldDescription>
              Shown on the leaderboard. Usernames cannot be changed after account creation.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Email</FieldLabel>
            <Input value={user.email || ""} disabled />
            <FieldDescription>
              Your email address cannot be changed.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Member since</FieldLabel>
            <Input
              value={new Date(profile?.created_at || user.created_at).toLocaleDateString()}
              disabled
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Learning Preferences</CardTitle>
          <CardDescription>
            Update your language learning settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Target language</FieldLabel>
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
                      : "Select a language"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Search languages..." />
                    <CommandList>
                      <CommandEmpty>No language found.</CommandEmpty>
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
              <FieldDescription>The language you want to learn</FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Native language</FieldLabel>
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
                      : "Select your native language"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Search languages..." />
                    <CommandList>
                      <CommandEmpty>No language found.</CommandEmpty>
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
                <FieldLabel>Age group</FieldLabel>
                <Select
                  value={ageGroup}
                  onValueChange={setAgeGroup}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="child">Child</SelectItem>
                    <SelectItem value="teen">Teen</SelectItem>
                    <SelectItem value="adult">Adult</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Education level</FieldLabel>
                <Select
                  value={educationLevel}
                  onValueChange={setEducationLevel}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elementary">Elementary</SelectItem>
                    <SelectItem value="middle">Middle School</SelectItem>
                    <SelectItem value="high">High School</SelectItem>
                    <SelectItem value="college">College</SelectItem>
                    <SelectItem value="graduate">Graduate</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </Field>

            <Field>
              <FieldLabel>Years of prior study</FieldLabel>
              <Input
                type="number"
                min={0}
                max={50}
                value={yearsLearning}
                onChange={(e) => setYearsLearning(e.target.value)}
                disabled={isLoading}
              />
            </Field>

            <Field>
              <FieldLabel>Speech style</FieldLabel>
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
                      <span className="font-medium">{level.label}</span>
                      <span className="text-muted-foreground"> — {level.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                This affects the vocabulary and tone of generated content.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Interface language</FieldLabel>
              <FieldDescription>
                Controls whether the app UI appears in your native or target language.
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
                  <span className="text-sm font-medium">Native language</span>
                  <span className="text-xs text-muted-foreground">Use your native language</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUiLanguage("target")}
                  disabled={isLoading}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-4 transition-all hover:bg-accent cursor-pointer ${
                    uiLanguage === "target" ? "border-primary bg-accent" : "border-border"
                  }`}
                >
                  <span className="text-sm font-medium">Target language</span>
                  <span className="text-xs text-muted-foreground">Immerse in the language you&apos;re learning</span>
                </button>
              </div>
            </Field>

            <Field>
              <FieldLabel>Learning motivations</FieldLabel>
              <FieldDescription>Select all that apply.</FieldDescription>
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
                    {motivation.label}
                  </label>
                ))}
              </div>
            </Field>

          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
          <CardDescription>Control how you appear to others</CardDescription>
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
              <p className="text-sm font-medium leading-none">Hide my name on the leaderboard</p>
              <p className="text-sm text-muted-foreground mt-1">
                When enabled, you appear as &quot;Anonymous&quot; on the global and friends leaderboards.
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Theme Preferences</CardTitle>
          <CardDescription>
            Customize your visual experience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldLabel>Theme</FieldLabel>
            <FieldDescription>
              Choose your preferred theme. System will follow your operating system settings.
            </FieldDescription>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <button
                onClick={() => setTheme("light")}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:bg-accent ${
                  mounted && theme === "light"
                    ? "border-primary bg-accent"
                    : "border-border"
                }`}
              >
                <Sun className="size-6" />
                <span className="text-sm font-medium">Light</span>
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:bg-accent ${
                  mounted && theme === "dark"
                    ? "border-primary bg-accent"
                    : "border-border"
                }`}
              >
                <Moon className="size-6" />
                <span className="text-sm font-medium">Dark</span>
              </button>
              <button
                onClick={() => setTheme("system")}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:bg-accent ${
                  mounted && theme === "system"
                    ? "border-primary bg-accent"
                    : "border-border"
                }`}
              >
                <Monitor className="size-6" />
                <span className="text-sm font-medium">System</span>
              </button>
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <TriangleAlert className="size-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Sign out</p>
            </div>
            <Button variant="outline" onClick={handleSignOut} className="shrink-0">
              Sign out
            </Button>
          </div>

          <div className="border-t border-border pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Delete account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data. This cannot be undone.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                className="shrink-0"
              >
                Delete account
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
                <DialogTitle className="text-destructive">Delete account</DialogTitle>
                <DialogDescription>
                  This will permanently delete your account and all your data. This cannot be undone.
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
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== "delete my account" || isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Permanently delete"}
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
            <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-3 shadow-lg">
              <p className="text-sm text-muted-foreground">You have unsaved changes</p>
              <Button onClick={handleSave} disabled={isLoading} size="sm">
                {isLoading ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
