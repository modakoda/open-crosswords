"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOutIcon, ShieldIcon, UserIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, useSession } from "@/lib/auth-client";
import type { Messages } from "@/lib/i18n";

/**
 * The account menu behind the header's avatar: everything to do with *who is
 * signed in* — the address, the per-audience dashboards and sign-out — lives
 * here rather than being spread across each dashboard's own toolbar, so there
 * is one place to look for it on every page.
 */
export function UserMenu({
  messages,
  isAdmin,
}: {
  messages: Messages["header"];
  /** Server-resolved (session + ADMIN_EMAILS); presentation only. */
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const email = session?.user?.email ?? "";

  // better-auth's client resolves to `{ data, error }` rather than throwing,
  // so a rejected sign-out (its rate limit covers /sign-out too) would
  // otherwise send us to a signed-out page with the session cookie still live.
  async function handleSignOut() {
    const result = await signOut();
    if (result?.error) {
      toast.error(messages.signOutFailed);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={messages.account}
        >
          {email ? (
            <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-xs font-semibold uppercase text-primary ring-1 ring-primary/20">
              {email.slice(0, 1)}
            </span>
          ) : (
            <UserIcon />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {session ? (
          <>
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
              {email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/client/dashboard">
                <UserIcon />
                {messages.nav.client}
              </Link>
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/admin/dashboard">
                  <ShieldIcon />
                  {messages.nav.admin}
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut}>
              <LogOutIcon />
              {messages.signOut}
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link href="/client/login">
                <UserIcon />
                {messages.nav.signIn}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/public/sign-up">
                <UserPlusIcon />
                {messages.signUp}
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
