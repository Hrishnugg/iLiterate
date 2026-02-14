"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Map proficiency self-assessment to starting skill levels (1-20)
const PROFICIENCY_TO_LEVEL: Record<string, number> = {
  complete_beginner: 1,  // A1
  beginner: 3,           // A1
  elementary: 5,         // A2
  intermediate: 8,       // B1
  upper_intermediate: 12, // B2
  advanced: 16,          // C1
};

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
  const proficiencyLevel = formData.get("proficiency-level") as string;
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

  if (!proficiencyLevel) {
    return { error: "Please select your current proficiency level." };
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    target_language: targetLanguage,
    native_language: nativeLanguage,
    age_group: ageGroup,
    education_level: educationLevel,
    years_learning: yearsLearning,
    learning_motivation: motivations,
    proficiency_level: proficiencyLevel,
  });

  if (error) {
    return { error: error.message };
  }

  // Create or update user_skill_levels based on self-assessment
  const startingLevel = PROFICIENCY_TO_LEVEL[proficiencyLevel] || 1;

  // Check if skill levels already exist
  const { data: existingSkills } = await supabase
    .from("user_skill_levels")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (existingSkills) {
    // Update existing record
    const { error: updateError } = await supabase
      .from("user_skill_levels")
      .update({
        reading_level: startingLevel,
        vocabulary_level: startingLevel,
        grammar_level: startingLevel,
        reading_xp: 0,
        vocabulary_xp: 0,
        grammar_xp: 0,
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Failed to update skill levels:", updateError);
    }
  } else {
    // Create new record
    const { error: insertError } = await supabase
      .from("user_skill_levels")
      .insert({
        user_id: user.id,
        reading_level: startingLevel,
        vocabulary_level: startingLevel,
        grammar_level: startingLevel,
        reading_xp: 0,
        vocabulary_xp: 0,
        grammar_xp: 0,
      });

    if (insertError) {
      console.error("Failed to create skill levels:", insertError);
    }
  }

  redirect("/home");
}
