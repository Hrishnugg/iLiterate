"use client";

import { useActionState, useState, useRef, startTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Check, ChevronsUpDown, Baby, User, UserCheck, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { completeOnboarding } from "@/app/(auth)/onboarding/actions";

// ── Data ──────────────────────────────────────────────────────────────────────

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

const AGE_GROUPS = [
  { value: "child", label: "Child", description: "Under 13", icon: Baby },
  { value: "teen", label: "Teen", description: "13–17", icon: User },
  { value: "adult", label: "Adult", description: "18+", icon: UserCheck },
];

const EDUCATION_LEVELS = [
  { value: "elementary", label: "Elementary" },
  { value: "middle", label: "Middle School" },
  { value: "high", label: "High School" },
  { value: "college", label: "College" },
  { value: "graduate", label: "Graduate" },
];

const PROFICIENCY_LEVELS = [
  {
    value: "complete_beginner",
    label: "Complete Beginner",
    description: "I know little to nothing",
  },
  {
    value: "beginner",
    label: "Beginner",
    description: "Some basics — greetings, numbers",
  },
  {
    value: "elementary",
    label: "Elementary",
    description: "I can form simple sentences",
  },
  {
    value: "intermediate",
    label: "Intermediate",
    description: "I can hold basic conversations",
  },
  {
    value: "upper_intermediate",
    label: "Upper Intermediate",
    description: "Comfortable, but not yet fluent",
  },
  { value: "advanced", label: "Advanced", description: "Nearly fluent" },
];

const FORMALITY_LEVELS = [
  {
    value: "casual",
    label: "Casual",
    description: "Informal — friends & family",
    emoji: "💬",
  },
  {
    value: "standard",
    label: "Standard",
    description: "Neutral, everyday communication",
    emoji: "🗣️",
  },
  {
    value: "professional",
    label: "Professional",
    description: "Business and work contexts",
    emoji: "💼",
  },
  {
    value: "academic",
    label: "Academic",
    description: "Scholarly, precise language",
    emoji: "📖",
  },
];

const MOTIVATIONS = [
  { id: "travel", label: "Travel", emoji: "✈️" },
  { id: "career", label: "Career", emoji: "💼" },
  { id: "academic", label: "Academic", emoji: "📚" },
  { id: "personal", label: "Personal Interest", emoji: "🌟" },
  { id: "family", label: "Family / Heritage", emoji: "❤️" },
  { id: "entertainment", label: "Entertainment", emoji: "🎬" },
];

const STEPS = [
  {
    title: "What would you like to learn?",
    description: "Choose your target and native language.",
  },
  {
    title: "Tell us about yourself",
    description: "Help us tailor content to your background.",
  },
  {
    title: "What's your current level?",
    description: "We'll match you with the right content.",
  },
  {
    title: "How do you want to learn?",
    description: "Choose the speech style that fits your goals.",
  },
  {
    title: "Why are you learning?",
    description: "Select all that apply.",
  },
  {
    title: "Choose your username",
    description: "This cannot be changed later, so choose carefully.",
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type FormState = {
  username: string;
  targetLanguage: string;
  nativeLanguage: string;
  ageGroup: string;
  educationLevel: string;
  yearsLearning: string;
  proficiencyLevel: string;
  speechFormality: string;
  motivations: string[];
  platformLanguage: "target" | "native";
};

// ── YearsPicker ───────────────────────────────────────────────────────────────

function YearsPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const num = Math.max(0, Math.min(50, parseInt(value) || 0));
  const prevNumRef = useRef(num);
  const [direction, setDirection] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const set = (next: number) => {
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
    <div className="flex items-center">
      {/* Stacked chevrons */}
      <div className="mr-2 flex flex-col">
        <button
          type="button"
          onClick={() => set(num + 1)}
          disabled={num >= 50}
          className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
        >
          <ChevronUp className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => set(num - 1)}
          disabled={num <= 0}
          className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>

      {/* Digit display — click to edit */}
      <div
        className="relative flex cursor-text items-center text-5xl font-bold tabular-nums leading-none text-foreground"
        onClick={() => { setDraft(String(num)); setEditing(true); }}
        onWheel={(e) => { e.preventDefault(); set(num + (e.deltaY < 0 ? 1 : -1)); }}
      >
        {/* Always rendered — establishes the container size */}
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

        {/* Input overlays exactly when editing — no layout shift */}
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

// ── OptionTile ────────────────────────────────────────────────────────────────

function OptionTile({
  selected,
  onClick,
  label,
  description,
  emoji,
  icon: Icon,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  description?: string;
  emoji?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-1 rounded-xl border-2 p-3 text-left text-sm",
        "transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/20",
        className
      )}
    >
      {Icon && (
        <Icon className={cn("size-5", selected ? "text-primary" : "text-muted-foreground")} aria-hidden />
      )}
      {!Icon && emoji && (
        <span className="text-xl leading-none" aria-hidden>
          {emoji}
        </span>
      )}
      <span
        className={cn(
          "font-medium leading-tight pr-5",
          selected ? "text-primary" : "text-foreground"
        )}
      >
        {label}
      </span>
      {description && (
        <span className="text-xs leading-snug text-muted-foreground">
          {description}
        </span>
      )}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "backOut" }}
            className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Check className="size-3" strokeWidth={3} />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

// ── Slide variants ────────────────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -40, opacity: 0 }),
};

// ── OnboardingForm ────────────────────────────────────────────────────────────

export function OnboardingForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [actionState, formAction, pending] = useActionState(
    completeOnboarding,
    null
  );

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [failedFields, setFailedFields] = useState<string[]>([]);
  const [flashKey, setFlashKey] = useState(0);
  const [targetOpen, setTargetOpen] = useState(false);
  const [nativeOpen, setNativeOpen] = useState(false);

  const [form, setForm] = useState<FormState>({
    username: "",
    targetLanguage: "",
    nativeLanguage: "",
    ageGroup: "",
    educationLevel: "",
    yearsLearning: "0",
    proficiencyLevel: "",
    speechFormality: "standard",
    motivations: [],
    platformLanguage: "native",
  });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFailedFields((prev) => prev.filter((f) => f !== key));
  };

  const toggleMotivation = (id: string) => {
    setForm((prev) => ({
      ...prev,
      motivations: prev.motivations.includes(id)
        ? prev.motivations.filter((m) => m !== id)
        : [...prev.motivations, id],
    }));
  };

  const getFailedFields = (): string[] => {
    switch (step) {
      case 0: {
        const failed = [];
        if (!form.targetLanguage) failed.push("targetLanguage");
        if (!form.nativeLanguage) failed.push("nativeLanguage");
        return failed;
      }
      case 1: {
        const failed = [];
        if (!form.ageGroup) failed.push("ageGroup");
        if (!form.educationLevel) failed.push("educationLevel");
        return failed;
      }
      case 2:
        return form.proficiencyLevel ? [] : ["proficiencyLevel"];
      case 3:
        return form.speechFormality ? [] : ["speechFormality"];
      case 5: {
        const u = form.username;
        if (!u || u.length < 3 || u.length > 20 || !/^[a-z0-9_]+$/.test(u)) {
          return ["username"];
        }
        return [];
      }
      default:
        return [];
    }
  };

  const goNext = () => {
    const failed = getFailedFields();
    if (failed.length > 0) {
      setFailedFields(failed);
      setFlashKey((k) => k + 1);
      return;
    }
    setFailedFields([]);
    setDirection(1);
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setFailedFields([]);
    setDirection(-1);
    setStep((s) => s - 1);
  };

  const handleSubmit = () => {
    const fd = new FormData();
    fd.set("username", form.username);
    fd.set("target-language", form.targetLanguage);
    fd.set("native-language", form.nativeLanguage);
    fd.set("age-group", form.ageGroup);
    fd.set("education-level", form.educationLevel);
    fd.set("years-learning", form.yearsLearning);
    fd.set("proficiency-level", form.proficiencyLevel);
    fd.set("speech-formality", form.speechFormality);
    fd.set("platform-language", form.platformLanguage);
    form.motivations.forEach((m) => fd.append("motivation", m));
    startTransition(() => formAction(fd));
  };

  const isLast = step === STEPS.length - 1;
  const currentStep = STEPS[step];

  const renderContent = () => {
    switch (step) {
      // ── Step 0: Languages ──────────────────────────────────────────────────
      case 0:
        return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="target-language">
                I want to learn
              </label>
              <div key={failedFields.includes("targetLanguage") ? `tl-${flashKey}` : "tl"} className={cn(failedFields.includes("targetLanguage") && "field-flash")}>
                <Popover open={targetOpen} onOpenChange={setTargetOpen}>
                  <PopoverTrigger asChild>
                    <button
                      id="target-language"
                      role="combobox"
                      aria-expanded={targetOpen}
                      className={cn(
                        "flex h-11 w-full items-center justify-between rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm transition-colors hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        failedFields.includes("targetLanguage") ? "border-destructive" : "border-input",
                        !form.targetLanguage && "text-muted-foreground"
                      )}
                    >
                      {form.targetLanguage
                        ? LANGUAGES.find((l) => l.toLowerCase() === form.targetLanguage)
                        : "Select a language…"}
                      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search language…" />
                      <CommandList>
                        <CommandEmpty>No language found.</CommandEmpty>
                        <CommandGroup>
                          {LANGUAGES.map((lang) => (
                            <CommandItem
                              key={lang}
                              value={lang}
                              disabled={lang.toLowerCase() === form.nativeLanguage}
                              onSelect={() => {
                                update("targetLanguage", lang.toLowerCase());
                                setTargetOpen(false);
                                (document.activeElement as HTMLElement)?.blur();
                              }}
                            >
                              <Check className={cn("mr-2 size-4", form.targetLanguage === lang.toLowerCase() ? "opacity-100" : "opacity-0")} />
                              {lang}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="native-language">
                My native language is
              </label>
              <div key={failedFields.includes("nativeLanguage") ? `nl-${flashKey}` : "nl"} className={cn(failedFields.includes("nativeLanguage") && "field-flash")}>
                <Popover open={nativeOpen} onOpenChange={setNativeOpen}>
                  <PopoverTrigger asChild>
                    <button
                      id="native-language"
                      role="combobox"
                      aria-expanded={nativeOpen}
                      className={cn(
                        "flex h-11 w-full items-center justify-between rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm transition-colors hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        failedFields.includes("nativeLanguage") ? "border-destructive" : "border-input",
                        !form.nativeLanguage && "text-muted-foreground"
                      )}
                    >
                      {form.nativeLanguage
                        ? LANGUAGES.find((l) => l.toLowerCase() === form.nativeLanguage)
                        : "Select your native language…"}
                      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search language…" />
                      <CommandList>
                        <CommandEmpty>No language found.</CommandEmpty>
                        <CommandGroup>
                          {LANGUAGES.map((lang) => (
                            <CommandItem
                              key={lang}
                              value={lang}
                              disabled={lang.toLowerCase() === form.targetLanguage}
                              onSelect={() => {
                                update("nativeLanguage", lang.toLowerCase());
                                setNativeOpen(false);
                                (document.activeElement as HTMLElement)?.blur();
                              }}
                            >
                              <Check className={cn("mr-2 size-4", form.nativeLanguage === lang.toLowerCase() ? "opacity-100" : "opacity-0")} />
                              {lang}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        );

      // ── Step 1: About You ──────────────────────────────────────────────────
      case 1:
        return (
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-2.5 text-sm font-medium">Age group</p>
              <div key={failedFields.includes("ageGroup") ? `ag-${flashKey}` : "ag"} className={cn("grid grid-cols-3 gap-2 rounded-xl", failedFields.includes("ageGroup") && "ring-2 ring-destructive field-flash")}>
                {AGE_GROUPS.map((a) => (
                  <OptionTile
                    key={a.value}
                    selected={form.ageGroup === a.value}
                    onClick={() => update("ageGroup", a.value)}
                    label={a.label}
                    description={a.description}
                    icon={a.icon}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2.5 text-sm font-medium">Education level</p>
              <div key={failedFields.includes("educationLevel") ? `el-${flashKey}` : "el"} className={cn("grid grid-cols-2 gap-2 rounded-xl sm:grid-cols-3", failedFields.includes("educationLevel") && "ring-2 ring-destructive field-flash")}>
                {EDUCATION_LEVELS.map((e) => (
                  <OptionTile
                    key={e.value}
                    selected={form.educationLevel === e.value}
                    onClick={() => update("educationLevel", e.value)}
                    label={e.label}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2.5 text-sm font-medium">Platform language</p>
              <p className="mb-2.5 text-xs text-muted-foreground">Which language should the app interface be displayed in?</p>
              <div className="grid grid-cols-2 gap-2">
                <OptionTile
                  selected={form.platformLanguage === "native"}
                  onClick={() => update("platformLanguage", "native")}
                  label="Native language"
                  description="Familiar — learn with your own language as context"
                />
                <OptionTile
                  selected={form.platformLanguage === "target"}
                  onClick={() => update("platformLanguage", "target")}
                  label="Target language"
                  description="Immersive — everything in the language you're learning"
                />
              </div>
            </div>
          </div>
        );

      // ── Step 2: Experience ─────────────────────────────────────────────────
      case 2:
        return (
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-2.5 text-sm font-medium">Current proficiency</p>
              <div key={failedFields.includes("proficiencyLevel") ? `pl-${flashKey}` : "pl"} className={cn("flex flex-col gap-1.5 rounded-xl", failedFields.includes("proficiencyLevel") && "ring-2 ring-destructive field-flash")}>
                {PROFICIENCY_LEVELS.map((p) => (
                  <OptionTile
                    key={p.value}
                    selected={form.proficiencyLevel === p.value}
                    onClick={() => update("proficiencyLevel", p.value)}
                    label={p.label}
                    description={p.description}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">Years of prior study</p>
              <YearsPicker
                value={form.yearsLearning}
                onChange={(v) => update("yearsLearning", v)}
              />
            </div>
          </div>
        );

      // ── Step 3: Learning Style ─────────────────────────────────────────────
      case 3:
        return (
          <div className="grid grid-cols-2 gap-2">
            {FORMALITY_LEVELS.map((f) => (
              <OptionTile
                key={f.value}
                selected={form.speechFormality === f.value}
                onClick={() => update("speechFormality", f.value)}
                label={f.label}
                description={f.description}
                emoji={f.emoji}
              />
            ))}
          </div>
        );

      // ── Step 4: Goals ──────────────────────────────────────────────────────
      case 4:
        return (
          <div className="grid grid-cols-2 gap-2">
            {MOTIVATIONS.map((m) => (
              <OptionTile
                key={m.id}
                selected={form.motivations.includes(m.id)}
                onClick={() => toggleMotivation(m.id)}
                label={m.label}
                emoji={m.emoji}
              />
            ))}
          </div>
        );

      // ── Step 5: Username ───────────────────────────────────────────────────
      case 5: {
        const isInvalid = failedFields.includes("username");
        const usernameOk =
          form.username.length >= 3 &&
          form.username.length <= 20 &&
          /^[a-z0-9_]+$/.test(form.username);
        return (
          <div className="flex flex-col gap-0">
            {/* Input row */}
            <div
              key={isInvalid ? `un-${flashKey}` : "un"}
              className={cn(
                "flex items-center gap-2 pb-2 pt-3.5 transition-all duration-200",
                isInvalid && "field-flash"
              )}
            >
              {/* @ prefix */}
              <span
                className={cn(
                  "shrink-0 select-none font-mono font-bold leading-none transition-colors duration-200",
                  isInvalid ? "text-destructive" : "text-primary"
                )}
                style={{ fontSize: "2rem" }}
              >
                @
              </span>

              {/* Text input */}
              <input
                id="username"
                type="text"
                value={form.username}
                onChange={(e) => {
                  const clean = e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, "")
                    .slice(0, 20);
                  update("username", clean);
                }}
                placeholder="your_handle"
                maxLength={20}
                autoComplete="username"
                spellCheck={false}
                autoFocus
                className="min-w-0 flex-1 bg-transparent font-mono text-2xl font-semibold tracking-wide text-foreground outline-none placeholder:text-muted-foreground/40"
              />
            </div>

            {/* Divider */}
            <div className={cn("border-t", isInvalid ? "border-destructive" : usernameOk ? "border-primary" : "border-border")} />

            {/* Below-box row: hint + char count */}
            <div className="flex items-center justify-between pt-1.5">
              <p className={cn("text-xs", isInvalid ? "text-destructive" : "text-muted-foreground")}>
                {isInvalid
                  ? form.username.length < 3
                    ? "Must be at least 3 characters."
                    : "Only lowercase letters (a–z), numbers, and underscores."
                  : "Lowercase letters, numbers, and underscores only."}
              </p>
              <span
                className={cn(
                  "font-mono text-xs tabular-nums transition-colors",
                  form.username.length >= 18
                    ? "text-destructive"
                    : "text-muted-foreground/50"
                )}
              >
                {form.username.length}/20
              </span>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className={cn("w-full", className)} {...props}>
      <style>{`
        @keyframes field-shake {
          0%, 100% { transform: translateX(0); }
          20%  { transform: translateX(-3px); }
          40%  { transform: translateX(3px); }
          60%  { transform: translateX(-2px); }
          80%  { transform: translateX(2px); }
        }
        .field-flash { animation: field-shake 0.4s ease-in-out; }
      `}</style>
      <Card className="pb-0">
        {/* Animated content — card frame stays fixed, content slides within.
            layout animates height morphing; popLayout immediately removes exiting
            element from flow so the container adopts the new height, then layout
            animates the delta. position:relative is required for popLayout's
            absolute-positioned exiting children to anchor correctly. */}
        <motion.div
          layout
          style={{ position: "relative", overflow: "hidden" }}
          transition={{ layout: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
        >
          <AnimatePresence mode="popLayout" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="mt-1 text-xl leading-snug">
                  {currentStep.title}
                </CardTitle>
                <CardDescription className="text-sm">
                  {currentStep.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-0">
                {renderContent()}
                {actionState?.error && (
                  <p className="mt-4 text-sm text-destructive">
                    {actionState.error}
                  </p>
                )}
              </CardContent>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Static footer nav — always visible */}
        <div className="relative flex items-center justify-end px-6 pb-6">
          {step > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={goBack}
              disabled={pending}
              className="mr-auto gap-1"
            >
              <ChevronLeft className="size-4" />
              Back
            </Button>
          )}
          {/* Progress dots */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  width: i === step ? "1.5rem" : "0.5rem",
                  opacity: i <= step ? 1 : 0.3,
                }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "h-2 rounded-full",
                  i <= step ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
          {isLast ? (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              className="min-w-[5rem]"
            >
              {pending ? "Saving…" : "Finish"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={goNext}
              className="min-w-[5rem] gap-1"
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
