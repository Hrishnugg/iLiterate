"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2 } from "lucide-react";

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
import { signup } from "@/app/(auth)/actions";

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [state, formAction, pending] = useActionState(signup, null);
  const [errorVisible, setErrorVisible] = useState(false);

  // Detect the pending→false transition synchronously to avoid a render where
  // showError is still false (which would flash "Create Account" between "Creating account..." and error)
  const prevPendingRef = useRef(false);
  const wasPending = prevPendingRef.current;
  prevPendingRef.current = pending;
  const showError = errorVisible || (!pending && wasPending && !!state?.error);

  useEffect(() => {
    if (pending) { setErrorVisible(false); return; }
    if (!state?.error) return;
    setErrorVisible(true);
    const timer = setTimeout(() => setErrorVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [pending, state]);

  // Show success message after signup
  if (state?.success) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <div className="relative mx-auto h-16 w-16 flex items-center justify-center mb-4">
              <span className="absolute inset-0 rounded-full bg-green-500/20 animate-ping [animation-duration:2s]" />
              <span className="relative h-16 w-16 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </span>
            </div>
            <CardTitle className="text-xl">Check your email</CardTitle>
            <CardDescription className="mt-1 leading-relaxed">
              We&apos;ve sent a confirmation link to your email address.{" "}
              Click the link to verify your account and complete signup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              <p>Didn&apos;t receive the email?</p>
              <p className="mt-1">Check your spam folder or <Link href="/signup" className="text-primary hover:underline">try again</Link></p>
            </div>
            <div className="pt-4 border-t">
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  Back to Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Enter your email below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Full Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="John Doe"
                  defaultValue={state?.fields?.name}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  defaultValue={state?.fields?.email}
                  aria-invalid={showError && state?.errorFields?.includes("email")}
                  required
                />
              </Field>
              <Field>
                <Field className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      aria-invalid={showError && state?.errorFields?.includes("password")}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="confirm-password">
                      Confirm Password
                    </FieldLabel>
                    <Input
                      id="confirm-password"
                      name="confirm-password"
                      type="password"
                      aria-invalid={showError && state?.errorFields?.includes("confirm-password")}
                      required
                    />
                  </Field>
                </Field>
                <FieldDescription>
                  Must be at least 8 characters long.
                </FieldDescription>
              </Field>
              <Field>
                <Button
                  type="submit"
                  variant={showError ? "destructive" : "default"}
                  className="w-full overflow-hidden transition-colors duration-300"
                  disabled={pending}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={pending || showError ? "active" : "idle"}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      {pending ? "Creating account..." : showError ? state!.error : "Create Account"}
                    </motion.span>
                  </AnimatePresence>
                </Button>
                <FieldDescription className="text-center">
                  Already have an account?{" "}
                  <Link href="/login">Sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our{" "}
        <Link href="#">Terms of Service</Link> and{" "}
        <Link href="#">Privacy Policy</Link>.
      </FieldDescription>
    </div>
  );
}
