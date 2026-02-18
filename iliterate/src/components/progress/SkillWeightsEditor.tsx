"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { WEIGHT_PRESETS, WeightPresetKey } from "@/lib/level-system";
import { BookOpen, Languages, PenTool, Loader2 } from "lucide-react";

interface SkillWeightsEditorProps {
  currentWeights: {
    reading: number;
    vocabulary: number;
    grammar: number;
  };
  onUpdate?: () => void;
}

export function SkillWeightsEditor({
  currentWeights,
  onUpdate,
}: SkillWeightsEditorProps) {
  const [weights, setWeights] = useState(currentWeights);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleWeightChange = (skill: "reading" | "vocabulary" | "grammar", value: number) => {
    const newWeights = { ...weights };
    const oldValue = newWeights[skill];
    const diff = value - oldValue;

    // Adjust the new value
    newWeights[skill] = value;

    // Distribute the difference to other skills proportionally
    const otherSkills = (["reading", "vocabulary", "grammar"] as const).filter(
      (s) => s !== skill
    );
    const otherTotal = otherSkills.reduce((sum, s) => sum + newWeights[s], 0);

    if (otherTotal > 0) {
      otherSkills.forEach((s) => {
        const proportion = newWeights[s] / otherTotal;
        newWeights[s] = Math.max(0.05, newWeights[s] - diff * proportion);
      });
    }

    // Normalize to ensure sum is 1.0
    const total = newWeights.reading + newWeights.vocabulary + newWeights.grammar;
    newWeights.reading = Math.round((newWeights.reading / total) * 100) / 100;
    newWeights.vocabulary = Math.round((newWeights.vocabulary / total) * 100) / 100;
    newWeights.grammar = Math.round((1 - newWeights.reading - newWeights.vocabulary) * 100) / 100;

    setWeights(newWeights);
    setHasChanges(true);
  };

  const applyPreset = (presetKey: WeightPresetKey) => {
    const preset = WEIGHT_PRESETS[presetKey];
    setWeights({
      reading: preset.reading,
      vocabulary: preset.vocabulary,
      grammar: preset.grammar,
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reading_weight: weights.reading,
          vocabulary_weight: weights.vocabulary,
          grammar_weight: weights.grammar,
        }),
      });

      if (response.ok) {
        setHasChanges(false);
        onUpdate?.();
      }
    } catch (error) {
      console.error("Failed to save weights:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Learning Focus</CardTitle>
        <CardDescription>
          Adjust how each skill contributes to your overall level
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(WEIGHT_PRESETS) as WeightPresetKey[]).map((key) => (
            <Button
              key={key}
              variant="outline"
              size="sm"
              onClick={() => applyPreset(key)}
              className="text-xs"
            >
              {WEIGHT_PRESETS[key].description}
            </Button>
          ))}
        </div>

        {/* Sliders */}
        <div className="space-y-4">
          {/* Reading */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <BookOpen className="h-4 w-4 text-blue-500" />
                Reading
              </span>
              <span className="text-sm font-medium">
                {Math.round(weights.reading * 100)}%
              </span>
            </div>
            <Slider
              value={[weights.reading]}
              onValueChange={([value]) => handleWeightChange("reading", value)}
              min={0.1}
              max={0.7}
              step={0.05}
              className="[&_[role=slider]]:bg-blue-500"
            />
          </div>

          {/* Vocabulary */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <Languages className="h-4 w-4 text-green-500" />
                Vocabulary
              </span>
              <span className="text-sm font-medium">
                {Math.round(weights.vocabulary * 100)}%
              </span>
            </div>
            <Slider
              value={[weights.vocabulary]}
              onValueChange={([value]) => handleWeightChange("vocabulary", value)}
              min={0.1}
              max={0.7}
              step={0.05}
              className="[&_[role=slider]]:bg-green-500"
            />
          </div>

          {/* Grammar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <PenTool className="h-4 w-4 text-purple-500" />
                Grammar
              </span>
              <span className="text-sm font-medium">
                {Math.round(weights.grammar * 100)}%
              </span>
            </div>
            <Slider
              value={[weights.grammar]}
              onValueChange={([value]) => handleWeightChange("grammar", value)}
              min={0.1}
              max={0.7}
              step={0.05}
              className="[&_[role=slider]]:bg-purple-500"
            />
          </div>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
