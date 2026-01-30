import { BookOpen } from "lucide-react";

import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <a href="/" className="flex items-center gap-2 self-center font-medium">
        <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
          <BookOpen className="size-4" />
        </div>
        iLiterate
      </a>
      <LoginForm />
    </div>
  );
}
