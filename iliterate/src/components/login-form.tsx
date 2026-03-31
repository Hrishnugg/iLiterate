"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, type Transition } from "motion/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
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
import { login, forgotPassword, magicLink } from "@/app/(auth)/actions";

type View = "login" | "forgot" | "forgot-success" | "magic" | "magic-success";

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: -dir * 24 }),
};

const transition: Transition = { duration: 0.25, ease: "easeInOut" };

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [view, setView] = useState<View>("login");
  const [direction, setDirection] = useState(1);

  // ── Login state ──────────────────────────────────────────────────────────
  const [loginState, loginAction, loginPending] = useActionState(login, null);
  const [loginErrorVisible, setLoginErrorVisible] = useState(false);

  const prevPendingRef = useRef(false);
  const wasPending = prevPendingRef.current;
  prevPendingRef.current = loginPending;
  const showLoginError =
    loginErrorVisible || (!loginPending && wasPending && !!loginState?.error);

  useEffect(() => {
    if (loginPending) { setLoginErrorVisible(false); return; }
    if (!loginState?.error) return;
    setLoginErrorVisible(true);
    const timer = setTimeout(() => setLoginErrorVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [loginPending, loginState]);

  // ── Forgot-password state ────────────────────────────────────────────────
  const [forgotState, forgotAction, forgotPending] = useActionState(
    forgotPassword,
    null
  );

  useEffect(() => {
    if (forgotState?.success) setView("forgot-success");
  }, [forgotState]);

  // ── Magic-link state ─────────────────────────────────────────────────────
  const [magicState, magicAction, magicPending] = useActionState(
    magicLink,
    null
  );

  useEffect(() => {
    if (magicState?.success) setView("magic-success");
  }, [magicState]);

  // ── Client-side empty-field errors ───────────────────────────────────────
  const [forgotEmailError, setForgotEmailError] = useState<string | null>(null);
  const [magicEmailError, setMagicEmailError] = useState<string | null>(null);

  function goTo(next: View, dir: number) {
    setDirection(dir);
    setView(next);
    setForgotEmailError(null);
    setMagicEmailError(null);
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {/* Morphing card shell */}
      <motion.div
        layout
        className="bg-card text-card-foreground rounded-xl border shadow-sm overflow-hidden"
        transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
      >
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          {/* ── Login view ─────────────────────────────────────────────── */}
          {view === "login" && (
            <motion.div
              key="login"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="flex flex-col gap-6 py-6"
            >
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Welcome back</CardTitle>
                <CardDescription>
                  Enter your credentials to sign in
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={loginAction}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="m@example.com"
                        defaultValue={loginState?.fields?.email}
                        aria-invalid={
                          showLoginError &&
                          loginState?.errorFields?.includes("email")
                        }
                        required
                      />
                    </Field>
                    <Field>
                      <div className="flex items-center justify-between">
                        <FieldLabel htmlFor="password">Password</FieldLabel>
                        <button
                          type="button"
                          onClick={() => goTo("forgot", 1)}
                          className="text-sm underline-offset-4 hover:underline cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        aria-invalid={
                          showLoginError &&
                          loginState?.errorFields?.includes("password")
                        }
                        required
                      />
                    </Field>
                    <Field>
                      <Button
                        type="submit"
                        variant={showLoginError ? "destructive" : "default"}
                        className="w-full overflow-hidden transition-colors duration-300"
                        disabled={loginPending}
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={
                              loginPending || showLoginError ? "active" : "idle"
                            }
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                          >
                            {loginPending
                              ? "Signing in..."
                              : showLoginError
                              ? loginState!.error
                              : "Sign In"}
                          </motion.span>
                        </AnimatePresence>
                      </Button>
                      <FieldDescription className="text-center">
                        Don&apos;t have an account?{" "}
                        <Link href="/signup">Sign up</Link>
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </form>
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => goTo("magic", 1)}
                >
                  Email me a sign-in link
                </Button>
              </CardContent>
            </motion.div>
          )}

          {/* ── Forgot-password view ────────────────────────────────────── */}
          {view === "forgot" && (
            <motion.div
              key="forgot"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="flex flex-col gap-6 py-6"
            >
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Reset your password</CardTitle>
                <CardDescription>
                  Enter your email and we&apos;ll send you a reset link
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={forgotAction}
                  noValidate
                  onSubmit={(e) => {
                    const val = (e.currentTarget.elements.namedItem("email") as HTMLInputElement).value.trim();
                    if (!val) {
                      e.preventDefault();
                      setForgotEmailError("Please enter your email address.");
                    }
                  }}
                >
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
                      <Input
                        id="forgot-email"
                        name="email"
                        type="email"
                        placeholder="m@example.com"
                        aria-invalid={!!forgotEmailError}
                        onChange={() => setForgotEmailError(null)}
                      />
                      <AnimatePresence>
                        {forgotEmailError && (
                          <motion.p
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="bg-destructive text-destructive-foreground text-sm rounded-md px-3 py-2 mt-1"
                          >
                            {forgotEmailError}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </Field>
                    {forgotState?.error && (
                      <p className="text-destructive text-sm text-center">
                        {forgotState.error}
                      </p>
                    )}
                    <Field>
                      <Button
                        type="submit"
                        className="w-full overflow-hidden"
                        disabled={forgotPending}
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={forgotPending ? "sending" : "idle"}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                          >
                            {forgotPending ? "Sending..." : "Send reset link"}
                          </motion.span>
                        </AnimatePresence>
                      </Button>
                      <FieldDescription className="text-center">
                        <button
                          type="button"
                          onClick={() => goTo("login", -1)}
                          className="underline-offset-4 hover:underline cursor-pointer"
                        >
                          Back to sign in
                        </button>
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </form>
              </CardContent>
            </motion.div>
          )}

          {/* ── Forgot-success view ─────────────────────────────────────── */}
          {view === "forgot-success" && (
            <motion.div
              key="forgot-success"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="flex flex-col gap-6 py-6"
            >
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Check your email</CardTitle>
                <CardDescription>
                  If an account exists for that address, we&apos;ve sent a
                  password reset link.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldDescription className="text-center">
                  <button
                    type="button"
                    onClick={() => goTo("login", -1)}
                    className="underline-offset-4 hover:underline cursor-pointer"
                  >
                    Back to sign in
                  </button>
                </FieldDescription>
              </CardContent>
            </motion.div>
          )}

          {/* ── Magic-link view ──────────────────────────────────────────── */}
          {view === "magic" && (
            <motion.div
              key="magic"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="flex flex-col gap-6 py-6"
            >
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Sign in with a link</CardTitle>
                <CardDescription>
                  Enter your email and we&apos;ll send you a one-click sign-in
                  link
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={magicAction}
                  noValidate
                  onSubmit={(e) => {
                    const val = (e.currentTarget.elements.namedItem("email") as HTMLInputElement).value.trim();
                    if (!val) {
                      e.preventDefault();
                      setMagicEmailError("Please enter your email address.");
                    }
                  }}
                >
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="magic-email">Email</FieldLabel>
                      <Input
                        id="magic-email"
                        name="email"
                        type="email"
                        placeholder="m@example.com"
                        aria-invalid={!!magicEmailError}
                        onChange={() => setMagicEmailError(null)}
                      />
                      <AnimatePresence>
                        {magicEmailError && (
                          <motion.p
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="bg-destructive text-destructive-foreground text-sm rounded-md px-3 py-2 mt-1"
                          >
                            {magicEmailError}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </Field>
                    {magicState?.error && (
                      <p className="text-destructive text-sm text-center">
                        {magicState.error}
                      </p>
                    )}
                    <Field>
                      <Button
                        type="submit"
                        className="w-full overflow-hidden"
                        disabled={magicPending}
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={magicPending ? "sending" : "idle"}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                          >
                            {magicPending ? "Sending..." : "Send sign-in link"}
                          </motion.span>
                        </AnimatePresence>
                      </Button>
                      <FieldDescription className="text-center">
                        <button
                          type="button"
                          onClick={() => goTo("login", -1)}
                          className="underline-offset-4 hover:underline cursor-pointer"
                        >
                          Back to sign in
                        </button>
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </form>
              </CardContent>
            </motion.div>
          )}

          {/* ── Magic-success view ───────────────────────────────────────── */}
          {view === "magic-success" && (
            <motion.div
              key="magic-success"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="flex flex-col gap-6 py-6"
            >
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Check your email</CardTitle>
                <CardDescription>
                  We&apos;ve sent a sign-in link to your inbox. The link will
                  expire shortly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldDescription className="text-center">
                  <button
                    type="button"
                    onClick={() => goTo("login", -1)}
                    className="underline-offset-4 hover:underline cursor-pointer"
                  >
                    Back to sign in
                  </button>
                </FieldDescription>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our{" "}
        <Link href="#">Terms of Service</Link> and{" "}
        <Link href="#">Privacy Policy</Link>.
      </FieldDescription>
    </div>
  );
}
