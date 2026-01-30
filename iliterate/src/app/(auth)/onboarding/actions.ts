"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function completeOnboarding(
  prevState: { error: string } | null,
  formData: FormData
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const targetLanguage = formData.get("target-language") as string;
  const nativeLanguage = formData.get("native-language") as string;
  const ageGroup = formData.get("age-group") as string;
  const educationLevel = formData.get("education-level") as string;
  const yearsLearning = parseInt(
    (formData.get("years-learning") as string) || "0",
    10
  );
  const motivations = formData.getAll("motivation") as string[];

  if (!targetLanguage || !nativeLanguage) {
    return { error: "Please select both a target and native language." };
  }

  if (!ageGroup || !educationLevel) {
    return { error: "Please select your age group and education level." };
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    target_language: targetLanguage,
    native_language: nativeLanguage,
    age_group: ageGroup,
    education_level: educationLevel,
    years_learning: yearsLearning,
    learning_motivation: motivations,
    proficiency_level: "beginner",
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/library");
}
