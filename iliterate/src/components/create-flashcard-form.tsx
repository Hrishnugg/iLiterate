"use client";

import { useState, useEffect } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface UserLanguages {
  targetLanguage: string;
  nativeLanguage: string;
}

const termSchema = z.string().min(1, "Term is required").max(200, "Term too long");

export function CreateFlashcardForm() {
  const [userLanguages, setUserLanguages] = useState<UserLanguages | null>(null);
  const [term, setTerm] = useState("");
  const [translation, setTranslation] = useState<string | null>(null);
  const [pronunciation, setPronunciation] = useState<string | null>(null);
  const [partOfSpeech, setPartOfSpeech] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedBack, setCopiedBack] = useState(false);
  const [termError, setTermError] = useState<string | null>(null);

  // Fetch user's languages
  useEffect(() => {
    const fetchUserLanguages = async () => {
      try {
        const response = await fetch("/api/profile");
        if (!response.ok) throw new Error("Failed to fetch profile");
        const profile = await response.json();
        setUserLanguages({
          targetLanguage: profile.target_language,
          nativeLanguage: profile.native_language,
        });
      } catch (error) {
        console.error("Error fetching user languages:", error);
        toast.error("Failed to load your language settings");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserLanguages();
  }, []);

  const handleTranslate = async () => {
    if (!userLanguages) return;

    // Validate term
    const result = termSchema.safeParse(term);
    if (!result.success) {
      setTermError(result.error.issues[0]?.message || "Invalid term");
      return;
    }
    setTermError(null);

    try {
      setIsTranslating(true);
      setTranslation(null);
      setPronunciation(null);
      setPartOfSpeech(null);

      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: term,
          sourceLang: userLanguages.targetLanguage,
          targetLang: userLanguages.nativeLanguage,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to translate");
      }

      const result = await response.json();
      setTranslation(result.translation);
      setPronunciation(result.transliteration || null);
      setPartOfSpeech(result.partOfSpeech || null);
    } catch (error) {
      console.error("Translation error:", error);
      toast.error(error instanceof Error ? error.message : "Translation failed");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!translation || !userLanguages) {
      toast.error("Please translate the term first");
      return;
    }

    try {
      setIsSaving(true);

      const response = await fetch("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: term,
          language: userLanguages.targetLanguage,
          translation: translation,
          transliteration: pronunciation,
          partOfSpeech: partOfSpeech,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.message?.includes("already in your vocabulary")) {
          toast.info("This word is already in your vocabulary");
        } else {
          throw new Error(data.error || "Failed to save flashcard");
        }
      } else {
        toast.success("Flashcard created successfully!");
        setTerm("");
        setTranslation(null);
        setPronunciation(null);
        setPartOfSpeech(null);
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save flashcard");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="pt-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (!userLanguages) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="pt-6 text-center">
          <p className="text-destructive">Failed to load language settings</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Create Flashcard</CardTitle>
        <CardDescription>
          Enter a word or term in {userLanguages.targetLanguage}, and we'll translate it to {userLanguages.nativeLanguage}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Term Input */}
          <div className="space-y-2">
            <Label htmlFor="term">Term ({userLanguages.targetLanguage})</Label>
            <div className="flex gap-2">
              <Input
                id="term"
                placeholder={`Enter a word or phrase in ${userLanguages.targetLanguage}`}
                value={term}
                onChange={(e) => {
                  setTerm(e.target.value);
                  setTermError(null);
                }}
                disabled={isTranslating}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleTranslate}
                disabled={!term.trim() || isTranslating}
              >
                {isTranslating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Translate"
                )}
              </Button>
            </div>
            {termError && <p className="text-sm text-destructive">{termError}</p>}
          </div>

          {/* Translation Display */}
          {translation && (
            <div className="space-y-2">
              <Label>Translation ({userLanguages.nativeLanguage})</Label>
              <div className="flex items-center gap-2 p-3 bg-secondary rounded-md">
                <p className="flex-1 text-sm">{translation}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(translation);
                    setCopiedBack(true);
                    setTimeout(() => setCopiedBack(false), 2000);
                  }}
                >
                  {copiedBack ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Pronunciation Display */}
          {pronunciation && (
            <div className="space-y-2">
              <Label>Pronunciation</Label>
              <div className="p-3 bg-secondary rounded-md">
                <p className="text-sm text-muted-foreground italic">{pronunciation}</p>
              </div>
            </div>
          )}

          {/* Part of Speech Display */}
          {partOfSpeech && (
            <div className="space-y-2">
              <Label>Part of Speech</Label>
              <div className="p-3 bg-secondary rounded-md">
                <p className="text-sm font-medium">{partOfSpeech}</p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={!translation || isSaving}
            className="w-full"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Create Flashcard"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
