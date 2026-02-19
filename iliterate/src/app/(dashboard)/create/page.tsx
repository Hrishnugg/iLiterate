import { CreateFlashcardForm } from "@/components/create-flashcard-form";

export default function CreateFlashcardsPage() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create Flashcard</h1>
        <p className="text-muted-foreground mt-2">
          Manually create your own flashcard for a term.
        </p>
      </div>
      <CreateFlashcardForm />
    </div>
  );
}