"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, TriangleAlertIcon, UserIcon } from "lucide-react";

import { signIn, signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Messages } from "@/lib/i18n";

/** Shared shape for /client/login and /public/sign-up — only the submit action differs. */
export function ClientAuthForm({
  mode,
  messages,
}: {
  mode: "login" | "signup";
  messages: Messages["client"];
}) {
  const t = messages;
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } =
      mode === "login"
        ? await signIn.email({ email, password })
        : await signUp.email({ name, email, password });
    setBusy(false);
    if (err) {
      setError(mode === "login" ? "Invalid email or password." : t.errorGeneric);
      return;
    }
    router.push("/client/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 py-8">
      <Card>
        <CardHeader>
          <div className="mb-1 grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <UserIcon className="size-4" />
          </div>
          <CardTitle>{mode === "login" ? t.loginTitle : t.signupTitle}</CardTitle>
          <CardDescription>
            {mode === "login" ? t.loginDescription : t.signupDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="client-auth" onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">{t.name}</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t.email}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t.password}</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "signup" ? 12 : undefined}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
        <CardFooter>
          <Button type="submit" form="client-auth" className="w-full" disabled={busy}>
            {busy && <LoaderCircleIcon className="animate-spin" />}
            {busy ? t.submitting : mode === "login" ? t.submitLogin : t.submitSignup}
          </Button>
        </CardFooter>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        {mode === "login" ? (
          <>
            {t.noAccount} <a className="underline" href="/public/sign-up">{t.switchToSignup}</a>
          </>
        ) : (
          <>
            {t.haveAccount} <a className="underline" href="/client/login">{t.switchToLogin}</a>
          </>
        )}
      </p>
    </div>
  );
}
