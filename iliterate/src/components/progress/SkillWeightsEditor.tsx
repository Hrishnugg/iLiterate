"use client";

import {
  useState, useRef, useEffect, useCallback, useMemo,
  forwardRef, useImperativeHandle,
} from "react";
import { motion, useMotionValue, useSpring, useTransform, animate } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WEIGHT_PRESETS, WeightPresetKey } from "@/lib/level-system";
import { BookOpen, Languages, PenTool, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/I18nProvider";

const THUMB_PX = 20;

// ─── Types & redistribution ───────────────────────────────────────────────────

type Weights = { reading: number; vocabulary: number; grammar: number };
type Skill = keyof Weights;

function redistributeWeights(base: Weights, skill: Skill, value: number): Weights {
  const nw = { ...base };
  const diff = value - nw[skill];
  nw[skill] = value;

  const others = (["reading", "vocabulary", "grammar"] as Skill[]).filter((s) => s !== skill);
  const otherTotal = others.reduce((sum, s) => sum + nw[s], 0);
  if (otherTotal > 0) {
    others.forEach((s) => {
      nw[s] = Math.max(0.05, nw[s] - diff * (nw[s] / otherTotal));
    });
  }

  const total = nw.reading + nw.vocabulary + nw.grammar;
  nw.reading   = Math.round((nw.reading   / total) * 100) / 100;
  nw.vocabulary = Math.round((nw.vocabulary / total) * 100) / 100;
  nw.grammar   = Math.round((1 - nw.reading - nw.vocabulary) * 100) / 100;
  return nw;
}

// ─── MotionSlider ─────────────────────────────────────────────────────────────

export interface MotionSliderRef {
  /** Instantly reposition the thumb to a new value (used by parent for live sibling sync) */
  setValueInstant: (v: number) => void;
}

interface MotionSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  /** Fires every animation frame during drag AND inertia — no React state, just a value */
  onDragLive?: (v: number) => void;
  className?: string;
}

const MotionSlider = forwardRef<MotionSliderRef, MotionSliderProps>(
  function MotionSlider({ value, min, max, onChange, onDragLive, className }, ref) {
    const trackRef = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);
    const inertia  = useRef(false);
    const [trackWidth, setTrackWidth] = useState(300);
    const maxX = Math.max(1, trackWidth - THUMB_PX);

    useEffect(() => {
      const el = trackRef.current;
      if (!el) return;
      const ro = new ResizeObserver((e) => setTrackWidth(e[0].contentRect.width));
      ro.observe(el);
      setTrackWidth(el.offsetWidth);
      return () => ro.disconnect();
    }, []);

    const toX = useCallback(
      (v: number) => ((v - min) / (max - min)) * maxX,
      [min, max, maxX],
    );
    const fromX = useCallback(
      (x: number) => min + Math.max(0, Math.min(1, x / maxX)) * (max - min),
      [min, max, maxX],
    );
    const toFillWidth = useCallback(
      (x: number) => `${(Math.max(0, x) / maxX) * 100}%`,
      [maxX],
    );

    const thumbX  = useMotionValue(0);
    const springX = useSpring(thumbX, { stiffness: 500, damping: 40, mass: 0.6 });
    const fillWidth = useTransform(springX, toFillWidth);

    // Stable drag props — new object refs on every render would make Framer
    // Motion recalculate constraints mid-drag, causing jitter
    const dragConstraints = useMemo(() => ({ left: 0, right: maxX }), [maxX]);
    const dragTransition   = useMemo(() => ({
      power: 0.18,
      timeConstant: 200,
      modifyTarget: (t: number) => Math.max(0, Math.min(maxX, t)),
    }), [maxX]);

    // Expose instant repositioning so the parent can sync sibling sliders
    // without triggering React state updates
    useImperativeHandle(ref, () => ({
      setValueInstant(v) {
        thumbX.set(toX(Math.max(min, Math.min(max, v))));
      },
    }), [thumbX, toX, min, max]);

    // Sync committed value changes (preset buttons, drag-end commit)
    const prevMaxX = useRef(maxX);
    useEffect(() => {
      if (dragging.current || inertia.current) return;
      const x = toX(value);
      if (prevMaxX.current !== maxX) {
        thumbX.set(x);
        prevMaxX.current = maxX;
      } else {
        animate(thumbX, x, { type: "spring", stiffness: 380, damping: 30 });
      }
    }, [value, toX, maxX, thumbX]);

    return (
      <div
        ref={trackRef}
        className={cn(
          "relative flex h-5 w-full touch-none select-none items-center cursor-pointer",
          className,
        )}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).dataset.thumb) return;
          const rect = trackRef.current!.getBoundingClientRect();
          const x = Math.max(0, Math.min(maxX, e.clientX - rect.left - THUMB_PX / 2));
          animate(thumbX, x, { type: "spring", stiffness: 380, damping: 30 });
          onChange(fromX(x));
        }}
      >
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-border">
          <motion.div className="absolute inset-y-0 left-0 bg-primary" style={{ width: fillWidth }} />
        </div>

        <motion.div
          data-thumb="true"
          drag="x"
          dragConstraints={dragConstraints}
          dragElastic={0}
          dragMomentum
          dragTransition={dragTransition}
          style={{ x: thumbX, position: "absolute", left: 0, top: "50%", translateY: "-50%" }}
          whileDrag={{ scale: 1.25 }}
          onDragStart={() => {
            dragging.current = true;
            inertia.current  = false;
          }}
          onDrag={() => {
            onDragLive?.(fromX(Math.max(0, Math.min(maxX, thumbX.get()))));
          }}
          onDragEnd={() => {
            dragging.current = false;
            inertia.current  = true;

            // Keep firing onDragLive while inertia coasts so siblings stay in sync
            const unsub = thumbX.on("change", (x) => {
              onDragLive?.(fromX(Math.max(0, Math.min(maxX, x))));
            });

            setTimeout(() => {
              unsub();
              inertia.current = false;
              const x = Math.max(0, Math.min(maxX, thumbX.get()));
              onChange(fromX(x));
            }, 400);
          }}
          className="h-5 w-5 rounded-full border-2 border-primary bg-background shadow-sm cursor-grab active:cursor-grabbing"
        />
      </div>
    );
  },
);

// ─── SkillWeightsEditor ───────────────────────────────────────────────────────

interface SkillWeightsEditorProps {
  currentWeights: Weights;
  onUpdate?: () => void;
}

function detectPreset(w: Weights): WeightPresetKey | null {
  return (Object.keys(WEIGHT_PRESETS) as WeightPresetKey[]).find((key) => {
    const p = WEIGHT_PRESETS[key];
    return (
      Math.abs(p.reading    - w.reading)    < 0.02 &&
      Math.abs(p.vocabulary - w.vocabulary) < 0.02 &&
      Math.abs(p.grammar    - w.grammar)    < 0.02
    );
  }) ?? null;
}

export function SkillWeightsEditor({ currentWeights, onUpdate }: SkillWeightsEditorProps) {
  const t = useT();
  const [weights, setWeights] = useState(currentWeights);
  const [activePreset, setActivePreset] = useState<WeightPresetKey | null>(
    () => detectPreset(currentWeights),
  );
  const [isSaving, setIsSaving]   = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Refs to each slider for imperative position updates during live drag
  const readingRef = useRef<MotionSliderRef>(null);
  const vocabRef   = useRef<MotionSliderRef>(null);
  const grammarRef = useRef<MotionSliderRef>(null);

  // Refs to the percentage <span>s — updated via DOM mutation (no React re-render)
  const readingPctRef = useRef<HTMLSpanElement>(null);
  const vocabPctRef   = useRef<HTMLSpanElement>(null);
  const grammarPctRef = useRef<HTMLSpanElement>(null);

  // Tracks the committed weights so live redistribution always has a stable base
  const liveWeights = useRef<Weights>({ ...currentWeights });
  useEffect(() => { liveWeights.current = { ...weights }; }, [weights]);

  // Fires every animation frame during drag + inertia.
  // Redistributes from the pre-drag base, then updates sibling positions and all
  // percentage spans atomically — zero React state updates, always sums to 100%.
  const handleLiveDrag = useCallback((skill: Skill, value: number) => {
    const nw = redistributeWeights(liveWeights.current, skill, value);

    if (skill !== "reading")    readingRef.current?.setValueInstant(nw.reading);
    if (skill !== "vocabulary") vocabRef.current?.setValueInstant(nw.vocabulary);
    if (skill !== "grammar")    grammarRef.current?.setValueInstant(nw.grammar);

    if (readingPctRef.current) readingPctRef.current.textContent = `${Math.round(nw.reading    * 100)}%`;
    if (vocabPctRef.current)   vocabPctRef.current.textContent   = `${Math.round(nw.vocabulary * 100)}%`;
    if (grammarPctRef.current) grammarPctRef.current.textContent = `${Math.round(nw.grammar    * 100)}%`;
  }, []);

  // Called once on drag end / track click — commits weights to React state
  const handleWeightChange = (skill: Skill, value: number) => {
    const nw = redistributeWeights(weights, skill, value);
    setWeights(nw);
    setActivePreset(null);
    setHasChanges(true);
  };

  const applyPreset = (key: WeightPresetKey) => {
    const p = WEIGHT_PRESETS[key];
    setWeights({ reading: p.reading, vocabulary: p.vocabulary, grammar: p.grammar });
    setActivePreset(key);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reading_weight:    weights.reading,
          vocabulary_weight: weights.vocabulary,
          grammar_weight:    weights.grammar,
        }),
      });
      if (res.ok) { setHasChanges(false); onUpdate?.(); }
    } catch (err) {
      console.error("Failed to save weights:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const SLIDERS = [
    { skill: "reading"    as Skill, label: t("progress.skills.reading"),    icon: <BookOpen  className="h-4 w-4 text-primary" />, ref: readingRef, pctRef: readingPctRef, value: weights.reading    },
    { skill: "vocabulary" as Skill, label: t("progress.skills.vocabulary"), icon: <Languages className="h-4 w-4 text-primary" />, ref: vocabRef,   pctRef: vocabPctRef,   value: weights.vocabulary },
    { skill: "grammar"    as Skill, label: t("progress.skills.grammar"),    icon: <PenTool   className="h-4 w-4 text-primary" />, ref: grammarRef, pctRef: grammarPctRef,  value: weights.grammar    },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("progress.learningFocus")}</CardTitle>
        <CardDescription>{t("progress.learningFocusDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(WEIGHT_PRESETS) as WeightPresetKey[]).map((key) => (
            <Button
              key={key}
              variant={activePreset === key ? "default" : "outline"}
              size="sm"
              onClick={() => applyPreset(key)}
              className="text-xs"
            >
              {t(`progress.presets.${key}`)}
            </Button>
          ))}
        </div>

        <div className="space-y-5">
          {SLIDERS.map(({ skill, label, icon, ref, pctRef, value }) => (
            <div key={skill} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {icon}
                  {label}
                </span>
                <span ref={pctRef} className="font-mono text-sm font-medium tabular-nums">
                  {Math.round(value * 100)}%
                </span>
              </div>
              <MotionSlider
                ref={ref}
                value={value}
                min={0.1}
                max={0.7}
                onChange={(v) => handleWeightChange(skill, v)}
                onDragLive={(v) => handleLiveDrag(skill, v)}
              />
            </div>
          ))}
        </div>

        {hasChanges && (
          <Button onClick={handleSave} disabled={isSaving} variant="outline" className="w-full">
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("common.saving")}</> : t("progress.saveChanges")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
