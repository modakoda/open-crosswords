"use client";

import { useState } from "react";
import { MoreHorizontalIcon, ShieldIcon } from "lucide-react";

import { orpc } from "@/lib/orpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  isPendingAdmin: boolean;
  puzzleCount: number;
  solveCount: number;
  activeSessions: number;
  createdAt: string;
}

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * One row per registered account. The admin badge is read-only on purpose:
 * admin-ness is allow-list membership in ADMIN_EMAILS, deliberately kept out
 * of the database so there is one source of truth for it — which also means
 * the two destructive actions here refuse to touch an admin account, and the
 * server refuses again regardless of what this table renders.
 */
export function UserTable({
  rows,
  q,
  onChanged,
  onNotice,
  onError,
}: {
  rows: AdminUser[];
  q: string;
  onChanged: () => void;
  onNotice: (msg: string | null) => void;
  onError: (msg: string | null) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<AdminUser | null>(null);

  async function confirmDelete() {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    onError(null);
    try {
      await orpc.admin.users.delete({ id: target.id });
      onNotice(
        `Deleted ${target.email}. Any puzzles they generated are now anonymous.`,
      );
    } catch {
      onError(`Could not delete ${target.email}.`);
      return;
    }
    onChanged();
  }

  async function confirmRevoke() {
    const target = pendingRevoke;
    setPendingRevoke(null);
    if (!target) return;
    onError(null);
    try {
      const { revoked } = await orpc.admin.users.revokeSessions({ id: target.id });
      onNotice(`Signed ${target.email} out of ${revoked} session(s).`);
    } catch {
      onError(`Could not revoke sessions for ${target.email}.`);
      return;
    }
    onChanged();
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-center">Puzzles</TableHead>
              <TableHead className="text-center">Solving</TableHead>
              <TableHead className="text-center">Sessions</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No users {q ? "match your search" : "yet"}.
                </TableCell>
              </TableRow>
            )}
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="max-w-40 truncate">{u.name}</TableCell>
                <TableCell className="max-w-64 truncate">
                  <span className="font-mono text-xs">{u.email}</span>
                  {!u.emailVerified && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      Unverified
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {u.isAdmin ? (
                    <Badge className="gap-1">
                      <ShieldIcon className="size-3" />
                      Admin
                    </Badge>
                  ) : u.isPendingAdmin ? (
                    <Badge variant="outline" className="gap-1" title="Allow-listed in ADMIN_EMAILS, but the email is not verified yet">
                      <ShieldIcon className="size-3" />
                      Pending
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">Client</span>
                  )}
                </TableCell>
                <TableCell className="text-center tabular-nums">{u.puzzleCount}</TableCell>
                <TableCell className="text-center tabular-nums">{u.solveCount}</TableCell>
                <TableCell className="text-center tabular-nums">
                  {u.activeSessions}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {dateFormat.format(new Date(u.createdAt))}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={u.isAdmin || u.isPendingAdmin || u.activeSessions === 0}
                        onClick={() => setPendingRevoke(u)}
                      >
                        Sign out everywhere
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={u.isAdmin || u.isPendingAdmin}
                        onClick={() => setPendingDelete(u)}
                      >
                        Delete account
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => !open && setPendingRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign this user out everywhere?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRevoke?.email} will be signed out on every device. They can
              sign back in straight away — nothing else about the account changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRevoke}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.email} loses their sign-in and their saved solve
              progress ({pendingDelete?.solveCount} puzzle(s)). The{" "}
              {pendingDelete?.puzzleCount} puzzle(s) they generated stay in the
              library as anonymous ones, so shared links keep working. This
              can&apos;t be undone, and the address becomes free to sign up again.
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
