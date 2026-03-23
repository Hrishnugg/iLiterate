import { BookOpen } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh">
      {/* Brand panel — left half */}
      <div className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden bg-primary lg:flex">
        <style>{`
          .auth-char {
            transition: color 0.35s ease;
            cursor: default;
          }
          .auth-char:hover {
            color: rgba(180, 240, 190, 0.95) !important;
          }
        `}</style>
        {/* Decorative floating script characters */}
        <span className="auth-char absolute left-[10%] top-[10%] text-6xl font-light text-primary-foreground/[0.07]">
          文
        </span>
        <span className="auth-char absolute right-[12%] top-[22%] text-5xl font-light text-primary-foreground/[0.06]">
          あ
        </span>
        <span className="auth-char absolute bottom-[25%] left-[14%] text-5xl font-light text-primary-foreground/[0.07]">
          한
        </span>
        <span className="auth-char absolute bottom-[15%] right-[16%] text-5xl font-light text-primary-foreground/[0.06]">
          ع
        </span>
        <span className="auth-char absolute left-[8%] top-[45%] text-4xl font-light text-primary-foreground/[0.05]">
          Я
        </span>
        <span className="auth-char absolute right-[10%] top-[40%] text-4xl font-light text-primary-foreground/[0.06]">
          語
        </span>

        {/* Logo + tagline */}
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary-foreground/15">
              <BookOpen className="size-6 text-primary-foreground" />
            </div>
            <span className="text-3xl font-semibold tracking-tight text-primary-foreground">
              iLiterate
            </span>
          </div>
          <span className="text-base text-primary-foreground/70">
            Read the world. Learn as you go.
          </span>
        </div>
      </div>

      {/* Form panel — right half */}
      <div className="flex w-full flex-col items-center justify-center gap-6 p-6 md:p-10 lg:w-1/2">
        {children}
      </div>
    </div>
  );
}
