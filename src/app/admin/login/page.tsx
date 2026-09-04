"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, LockIcon, TriangleAlertIcon } from "lucide-react";

import { signIn } from "@/lib/auth-client";
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

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await signIn.email({ email, password });
    setBusy(false);
    if (err) {
      // Generic message — never disclose whether the account exists.
      setError("Invalid email or password.");
      return;
    }
    router.push("/admin/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 py-8">
      <Card>
        <CardHeader>
          <div className="mb-1 grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <LockIcon className="size-4" />
          </div>
          <CardTitle>Admin sign in</CardTitle>
          <CardDescription>
            The question library is managed by admins only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="login" onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
          <Button type="submit" form="login" className="w-full" disabled={busy}>
            {busy && <LoaderCircleIcon className="animate-spin" />}
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </CardFooter>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        Admin accounts are provisioned with <code>npm run create-admin</code> —
        this is separate from the public sign-up at{" "}
        <a className="underline" href="/public/sign-up">
          /public/sign-up
        </a>
        .
      </p>
    </div>
  );
}
