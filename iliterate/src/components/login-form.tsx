"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";

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
import { login } from "@/app/(auth)/actions";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [state, formAction, pending] = useActionState(login, null);
  const [errorVisible, setErrorVisible] = useState(false);

  // Detect the pending→false transition synchronously to avoid a render where
  // showError is still false (which would flash "Sign In" between "Signing in..." and error)
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

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Enter your credentials to sign in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction}>
            <FieldGroup>
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
                      {pending ? "Signing in..." : showError ? state!.error : "Sign In"}
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
