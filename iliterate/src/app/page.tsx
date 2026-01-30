import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">iLiterate</h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Read authentic content in new languages with instant translations,
          automatic flashcards, and adaptive learning.
        </p>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="rounded-md border border-input px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Sign Up
          </Link>
        </div>
      </main>
    </div>
  );
}
