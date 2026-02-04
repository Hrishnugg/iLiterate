"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";

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

interface Profile {
  id: string;
  native_language: string;
  target_language: string;
  age_group: string | null;
  education_level: string | null;
  years_learning: number | null;
  learning_motivation: string[] | null;
  proficiency_level: string | null;
  created_at: string;
  updated_at: string;
}

interface ProfileSettingsProps {
  user: User;
  profile: Profile | null;
}

export function ProfileSettings({ user, profile }: ProfileSettingsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Store initial values to track changes
  const initialValues = useMemo(() => ({
    targetLanguage: profile?.target_language || "",
    nativeLanguage: profile?.native_language || "",
    ageGroup: profile?.age_group || "",
    educationLevel: profile?.education_level || "",
    yearsLearning: profile?.years_learning?.toString() || "0",
    motivations: profile?.learning_motivation || [],
  }), [profile]);

  const [targetLanguage, setTargetLanguage] = useState(initialValues.targetLanguage);
  const [nativeLanguage, setNativeLanguage] = useState(initialValues.nativeLanguage);
  const [ageGroup, setAgeGroup] = useState(initialValues.ageGroup);
  const [educationLevel, setEducationLevel] = useState(initialValues.educationLevel);
  const [yearsLearning, setYearsLearning] = useState(initialValues.yearsLearning);
  const [motivations, setMotivations] = useState<string[]>(initialValues.motivations);

  // Check if any values have changed
  const hasChanges = useMemo(() => {
    const motivationsChanged =
      motivations.length !== initialValues.motivations.length ||
      motivations.some((m) => !initialValues.motivations.includes(m));

    return (
      targetLanguage !== initialValues.targetLanguage ||
      nativeLanguage !== initialValues.nativeLanguage ||
      ageGroup !== initialValues.ageGroup ||
      educationLevel !== initialValues.educationLevel ||
      yearsLearning !== initialValues.yearsLearning ||
      motivationsChanged
    );
  }, [targetLanguage, nativeLanguage, ageGroup, educationLevel, yearsLearning, motivations, initialValues]);

  const handleMotivationChange = (id: string, checked: boolean) => {
    setMotivations((prev) =>
      checked ? [...prev, id] : prev.filter((m) => m !== id)
    );
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    setIsLoading(true);

    try {
      const supabase = createClient();

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          target_language: targetLanguage,
          native_language: nativeLanguage,
          age_group: ageGroup,
          education_level: educationLevel,
          years_learning: parseInt(yearsLearning, 10),
          learning_motivation: motivations,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      console.error("Update error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
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
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600">
                Settings saved successfully!
              </div>
            )}
            <Field>
              <FieldLabel>Target language</FieldLabel>
              <Select
                value={targetLanguage}
                onValueChange={setTargetLanguage}
                disabled={isLoading}
              >
                <SelectTrigger>
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
              <FieldDescription>The language you want to learn</FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Native language</FieldLabel>
              <Select
                value={nativeLanguage}
                onValueChange={setNativeLanguage}
                disabled={isLoading}
              >
                <SelectTrigger>
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
              <FieldLabel>Learning motivations</FieldLabel>
              <FieldDescription>Select all that apply.</FieldDescription>
              <div className="grid grid-cols-2 gap-3 pt-1">
                {MOTIVATIONS.map((motivation) => (
                  <label
                    key={motivation.id}
                    className="flex items-center gap-2 text-sm"
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

            <Button onClick={handleSave} disabled={isLoading || !hasChanges}>
              {isLoading ? "Saving..." : "Save changes"}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sign out</CardTitle>
          <CardDescription>Sign out of your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
