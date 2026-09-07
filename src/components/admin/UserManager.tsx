"use client";

import { useCallback, useEffect, useState } from "react";
import { SearchIcon, TriangleAlertIcon } from "lucide-react";

import { UserTable, type AdminUser } from "./UserTable";
import { DEFAULT_PAGE_SIZE, TablePagination, lastPage } from "./TablePagination";
import { orpc } from "@/lib/orpc/client";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Sentinel for "don't filter" — an empty Select value is invalid. */
const ALL = "__all__";

const VERIFIED_FILTERS: Record<string, boolean | undefined> = {
  [ALL]: undefined,
  verified: true,
  unverified: false,
};

/**
 * The account listing. Every registered user, not just the ones who own
 * puzzles — a client account is created by public sign-up and may never have
 * generated anything, and an admin looking for one has only the address to go
 * on, so search covers name and email.
 */
export function UserManager() {
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [verified, setVerified] = useState<string>(ALL);
  const [msg, setMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const load = useCallback(() => {
    orpc.admin.users
      .list({
        q: q || undefined,
        verified: VERIFIED_FILTERS[verified],
        limit: pageSize,
        offset: page * pageSize,
      })
      .then((d) => {
        setRows(d.rows ?? []);
        setTotal(d.total ?? 0);
        // Deleting the last row of the last page leaves the offset past the
        // end; step back rather than stranding the admin on a blank page.
        const last = lastPage(d.total ?? 0, pageSize);
        if (page > last) setPage(last);
      })
      .catch(() => setMsg("Failed to load users"));
  }, [q, verified, page, pageSize]);

  useEffect(load, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name or email…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <Select
          value={verified}
          onValueChange={(v) => {
            setVerified(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Filter by verification">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All accounts</SelectItem>
            <SelectItem value="verified">Verified email</SelectItem>
            <SelectItem value="unverified">Unverified email</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {msg && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <UserTable
        rows={rows}
        q={q}
        onChanged={load}
        onNotice={setNotice}
        onError={setMsg}
      />

      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        noun="users"
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(0);
        }}
      />
    </div>
  );
}
