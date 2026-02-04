import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Must use literal strings for NEXT_PUBLIC_ vars - Next.js inlines them at build time
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
