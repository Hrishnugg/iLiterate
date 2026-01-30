"use client";

import Link from "next/link";

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
          <form>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="target-language">
                  What language do you want to learn?
                </FieldLabel>
                <Select name="target-language" required>
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
                <Select name="native-language" required>
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
                  <Select name="age-group" required>
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
                  <Select name="education-level" required>
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
                  name="years-learning"
                  type="number"
                  min={0}
                  max={50}
                  placeholder="0"
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
                        name="motivation"
                        value={motivation.id}
                      />
                      {motivation.label}
                    </label>
                  ))}
                </div>
              </Field>

              <Field>
                <Button type="submit" className="w-full">
                  Continue
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
