"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";

const LANGUAGES = [
  "Arabic",
  "Chinese (Mandarin)",
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

export function OnboardingForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [targetLanguage, setTargetLanguage] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [yearsLearning, setYearsLearning] = useState("0");
  const [motivations, setMotivations] = useState<string[]>([]);

  const handleMotivationChange = (id: string, checked: boolean) => {
    setMotivations((prev) =>
      checked ? [...prev, id] : prev.filter((m) => m !== id)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const supabase = createClient();

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setError("You must be logged in to complete onboarding");
        return;
      }

      // Update or create profile
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          target_language: targetLanguage,
          native_language: nativeLanguage,
          age_group: ageGroup,
          education_level: educationLevel,
          years_learning: parseInt(yearsLearning, 10),
          learning_motivation: motivations,
          updated_at: new Date().toISOString(),
        });

      if (profileError) {
        console.error("Profile error:", profileError);
        setError(profileError.message);
        return;
      }

      // Redirect to library
      router.push("/library");
      router.refresh();
    } catch (err) {
      console.error("Onboarding error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Set up your profile</CardTitle>
          <CardDescription>
            Tell us about yourself so we can personalize your experience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Field>
                <FieldLabel htmlFor="target-language">
                  What language do you want to learn?
                </FieldLabel>
                <Select value={targetLanguage} onValueChange={setTargetLanguage} required disabled={isLoading}>
                  <SelectTrigger id="target-language">
                    <SelectValue placeholder="Select a language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang} value={lang.toLowerCase()}>
                        {lang}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="native-language">
                  What is your native language?
                </FieldLabel>
                <Select value={nativeLanguage} onValueChange={setNativeLanguage} required disabled={isLoading}>
                  <SelectTrigger id="native-language">
                    <SelectValue placeholder="Select your native language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang} value={lang.toLowerCase()}>
                        {lang}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="age-group">Age group</FieldLabel>
                  <Select value={ageGroup} onValueChange={setAgeGroup} required disabled={isLoading}>
                    <SelectTrigger id="age-group">
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
                  <FieldLabel htmlFor="education-level">
                    Education level
                  </FieldLabel>
                  <Select value={educationLevel} onValueChange={setEducationLevel} required disabled={isLoading}>
                    <SelectTrigger id="education-level">
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
                <FieldLabel htmlFor="years-learning">
                  Years of prior study
                </FieldLabel>
                <Input
                  id="years-learning"
                  type="number"
                  min={0}
                  max={50}
                  placeholder="0"
                  value={yearsLearning}
                  onChange={(e) => setYearsLearning(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <FieldDescription>
                  How many years have you studied this language?
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Why are you learning?</FieldLabel>
                <FieldDescription>Select all that apply.</FieldDescription>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {MOTIVATIONS.map((motivation) => (
                    <label
                      key={motivation.id}
                      htmlFor={`motivation-${motivation.id}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        id={`motivation-${motivation.id}`}
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

              <Field>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Continue"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
