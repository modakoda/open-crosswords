"use client";

import { useState } from "react";
import { MoreHorizontalIcon } from "lucide-react";

import { orpc } from "@/lib/orpc/client";
import { UserBlockDialog } from "./UserBlockDialog";
import type { AdminUser } from "./UserTable";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** The confirmations this menu can be waiting on; only one is ever open. */
type Pending = "delete" | "revoke" | "block" | "unblock" | null;

/**
 * Everything an admin can do to one account. Each item is disabled exactly
 * where the server would refuse it, so nothing is offered that then comes back
 * as a refusal — and, just as deliberately, nothing is withheld that the server
 * would allow. The split is what the action does: an administrator's row is
 * never a target for the three that take access away, and always a legitimate
 * one for the two that give it back. The server enforces all of it again
 * regardless of what this renders.
 */
export function UserRowActions({
  user,
  onChanged,
  onNotice,
  onError,
}: {
  user: AdminUser;
  onChanged: () => void;
  onNotice: (msg: string | null) => void;
  onError: (msg: string | null) => void;
}) {
  const [pending, setPending] = useState<Pending>(null);

  /** Run one mutation, report it, and re-read the listing only if it worked. */
  async function run(action: () => Promise<string>, failure: string) {
    setPending(null);
    onError(null);
    try {
      onNotice(await action());
    } catch {
      onError(failure);
      return;
    }
    onChanged();
  }

  const confirmDelete = () =>
    run(async () => {
      await orpc.admin.users.delete({ id: user.id });
      return `Deleted ${user.email}. Any puzzles they generated are now anonymous.`;
    }, `Could not delete ${user.email}.`);

  const confirmRevoke = () =>
    run(async () => {
      const { revoked } = await orpc.admin.users.revokeSessions({ id: user.id });
      return `Signed ${user.email} out of ${revoked} session(s).`;
    }, `Could not revoke sessions for ${user.email}.`);

  const confirmBlock = (input: { reason?: string; days?: number }) =>
    run(async () => {
      const res = await orpc.admin.users.block({ id: user.id, ...input });
      const until = res.blockedUntil
        ? `until ${new Date(res.blockedUntil).toLocaleString()}`
        : "indefinitely";
      return `Blocked ${user.email} ${until}, ending ${res.revokedSessions} session(s).`;
    }, `Could not block ${user.email}.`);

  const confirmUnblock = () =>
    run(async () => {
      await orpc.admin.users.unblock({ id: user.id });
      return `Unblocked ${user.email}. They can sign in again.`;
    }, `Could not unblock ${user.email}.`);

  const clearLock = () =>
    run(async () => {
      const { cleared } = await orpc.admin.users.clearSignInLock({ id: user.id });
      return cleared
        ? `Cleared the sign-in lock on ${user.email}.`
        : `${user.email} was not locked out.`;
    }, `Could not clear the sign-in lock on ${user.email}.`);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Row actions">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {user.blocked ? (
            // Restorative, so it stays available against an admin row: the
            // server allows it there for the same reason — an administrator
            // whose account is blocked has no other way back in.
            <DropdownMenuItem onClick={() => setPending("unblock")}>
              Unblock account
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={user.isAdmin}
              onClick={() => setPending("block")}
            >
              Block account…
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            disabled={user.signInLockSeconds === 0}
            onClick={clearLock}
          >
            Clear sign-in lock
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={user.isAdmin || user.activeSessions === 0}
            onClick={() => setPending("revoke")}
          >
            Sign out everywhere
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={user.isAdmin}
            onClick={() => setPending("delete")}
          >
            Delete account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {pending === "block" && (
        <UserBlockDialog
          email={user.email}
          onCancel={() => setPending(null)}
          onConfirm={confirmBlock}
        />
      )}

      <AlertDialog
        open={pending === "unblock"}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lift the block on this account?</AlertDialogTitle>
            <AlertDialogDescription>
              {user.email} will be able to sign in again straight away. Their
              old sessions are gone, so they sign in fresh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnblock}>Unblock</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pending === "revoke"}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign this user out everywhere?</AlertDialogTitle>
            <AlertDialogDescription>
              {user.email} will be signed out on every device. They can sign
              back in straight away — nothing else about the account changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRevoke}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pending === "delete"}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              {user.email} loses their sign-in and their saved solve progress (
              {user.solveCount} puzzle(s)). The {user.puzzleCount} puzzle(s)
              they generated stay in the library as anonymous ones, so shared
              links keep working. This can&apos;t be undone, and the address
              becomes free to sign up again. To stop them signing in while
              keeping the account, block it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
