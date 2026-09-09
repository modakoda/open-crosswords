"use client";

import { BanIcon, ClockIcon, ShieldIcon, TriangleAlertIcon } from "lucide-react";

import { UserRowActions } from "./UserRowActions";
import { blockSummary, lockSummary } from "./user-status";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  holdsAdminAddress: boolean;
  /** In force right now — a lapsed timed block reports false. */
  blocked: boolean;
  blockedReason: string | null;
  blockedAt: string | null;
  blockedUntil: string | null;
  /** Seconds of automatic sign-in backoff left, or 0. Not a block. */
  signInLockSeconds: number;
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
 * One row per registered account.
 *
 * The role cell is read-only on purpose: admin-ness is allow-list membership
 * in ADMIN_EMAILS, deliberately kept out of the database so there is one
 * source of truth for it. Making it editable here would turn this screen into
 * a privilege-escalation lever, so an admin is provisioned out-of-band with
 * `npm run create-admin` and nothing on this page can grant or revoke it —
 * which is also why every action here refuses an admin row, and why the server
 * refuses again regardless of what this table renders.
 *
 * An account holding an allow-listed address *without* a verified email is the
 * opposite case and is flagged, not shielded: it has no admin access, and it
 * is what stands between an operator and provisioning that address.
 *
 * Status is a separate cell because it is a separate question, with two
 * unrelated answers: a block someone decided on, and the automatic sign-in
 * backoff nobody decided on.
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
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
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
                colSpan={9}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                No users {q ? "match your search" : "yet"}.
              </TableCell>
            </TableRow>
          )}
          {rows.map((u) => (
            <TableRow key={u.id} className={u.blocked ? "bg-destructive/5" : undefined}>
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
                ) : u.holdsAdminAddress ? (
                  <Badge
                    variant="destructive"
                    className="gap-1"
                    title="This address is in ADMIN_EMAILS but the account is an unverified public sign-up, so it has no admin access — and it blocks `npm run create-admin` from provisioning the address until it is removed."
                  >
                    <TriangleAlertIcon className="size-3" />
                    Unclaimed admin address
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Client</span>
                )}
              </TableCell>
              <TableCell className="space-x-1 whitespace-nowrap">
                {u.blocked && (
                  <Badge variant="destructive" className="gap-1" title={blockSummary(u)}>
                    <BanIcon className="size-3" />
                    Blocked
                  </Badge>
                )}
                {u.signInLockSeconds > 0 && (
                  <Badge
                    variant="outline"
                    className="gap-1"
                    title={`Too many failed sign-in attempts across all devices. Clears itself in ${lockSummary(u.signInLockSeconds)}, or an admin can clear it now.`}
                  >
                    <ClockIcon className="size-3" />
                    Locked out
                  </Badge>
                )}
                {!u.blocked && u.signInLockSeconds === 0 && (
                  <span className="text-sm text-muted-foreground">Active</span>
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
                <UserRowActions
                  user={u}
                  onChanged={onChanged}
                  onNotice={onNotice}
                  onError={onError}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
