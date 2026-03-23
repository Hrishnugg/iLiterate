"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SignupState = {
  error?: string;
  success?: boolean;
  fields?: { name: string; email: string };
  errorFields?: string[];
} | null;

export async function signup(
  prevState: SignupState,
  formData: FormData
): Promise<NonNullable<SignupState>> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirm-password") as string;

  const fields = { name, email };

  if (password !== confirmPassword) {
    return { error: "Passwords do not match.", fields, errorFields: ["password", "confirm-password"] };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long.", fields, errorFields: ["password", "confirm-password"] };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
    },
  });

  if (error) {
    return { error: error.message, fields, errorFields: ["email"] };
  }

  // Check if user already exists (Supabase returns user with identities = [] for existing emails)
  // When email confirmation is enabled and user already exists, Supabase doesn't return an error
  // but the user object has no identities
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { error: "An account with this email already exists. Please log in instead.", fields, errorFields: ["email"] };
  }

  // Success - email confirmation sent
  return { success: true };
}

export async function login(
  prevState: { error: string; fields?: { email: string }; errorFields?: string[] } | null,
  formData: FormData
) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();

  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message, fields: { email }, errorFields: ["email", "password"] };
  }

  // Check if user has completed onboarding
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .single();

  if (!profile) {
    redirect("/onboarding");
  }

  redirect("/home");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
