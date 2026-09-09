import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { UserManager } from "./UserManager";

/**
 * Radix renders a menu item as a `div`, so an unavailable one carries
 * `aria-disabled` rather than the `disabled` property `toBeDisabled` looks for.
 */
const DISABLED = ["aria-disabled", "true"] as const;

vi.mock("@/lib/orpc/client", () => ({
  orpc: {
    admin: {
      users: {
        list: vi.fn(),
        delete: vi.fn(),
        revokeSessions: vi.fn(),
        block: vi.fn(),
        unblock: vi.fn(),
        clearSignInLock: vi.fn(),
      },
    },
  },
}));

const { orpc } = await import("@/lib/orpc/client");
const list = vi.mocked(orpc.admin.users.list);
const remove = vi.mocked(orpc.admin.users.delete);
const revoke = vi.mocked(orpc.admin.users.revokeSessions);
const block = vi.mocked(orpc.admin.users.block);
const unblock = vi.mocked(orpc.admin.users.unblock);
const clearLock = vi.mocked(orpc.admin.users.clearSignInLock);

function account(
  id: string,
  over: Partial<{
    email: string;
    name: string;
    isAdmin: boolean;
    holdsAdminAddress: boolean;
    emailVerified: boolean;
    activeSessions: number;
    blocked: boolean;
    blockedReason: string | null;
    blockedUntil: string | null;
    signInLockSeconds: number;
  }> = {},
) {
  return {
    id,
    name: over.name ?? `User ${id}`,
    email: over.email ?? `${id}@example.com`,
    emailVerified: over.emailVerified ?? true,
    isAdmin: over.isAdmin ?? false,
    holdsAdminAddress: over.holdsAdminAddress ?? false,
    puzzleCount: 3,
    solveCount: 1,
    activeSessions: over.activeSessions ?? 2,
    blocked: over.blocked ?? false,
    blockedReason: over.blockedReason ?? null,
    blockedAt: over.blocked ? "2026-02-01T00:00:00.000Z" : null,
    blockedUntil: over.blockedUntil ?? null,
    signInLockSeconds: over.signInLockSeconds ?? 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

const rows = [
  account("boss", { email: "boss@example.com", isAdmin: true }),
  account("client", { email: "client@example.com" }),
];

const rowFor = (email: string) =>
  screen.getByRole("row", { name: new RegExp(email.replace(".", "\\.")) });

async function openActions(email: string) {
  await userEvent.click(
    within(rowFor(email)).getByRole("button", { name: "Row actions" }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue({ rows, total: rows.length });
  remove.mockResolvedValue({ deleted: true, email: "client@example.com" });
  revoke.mockResolvedValue({ revoked: 2 });
  block.mockResolvedValue({
    email: "client@example.com",
    blockedUntil: null,
    revokedSessions: 2,
  });
  unblock.mockResolvedValue({ email: "client@example.com" });
  clearLock.mockResolvedValue({ email: "client@example.com", cleared: true });
});

describe("UserManager", () => {
  it("lists accounts and separates admins from clients", async () => {
    render(<UserManager />);
    await screen.findByText("client@example.com");

    expect(within(rowFor("boss@example.com")).getByText("Admin")).toBeInTheDocument();
    expect(
      within(rowFor("client@example.com")).getByText("Client"),
    ).toBeInTheDocument();
  });

  /**
   * An unverified account on an allow-listed address has no admin access and
   * blocks `create-admin` from provisioning that address, so the screen must
   * flag it as a problem and leave it removable — shielding it like an admin
   * would make it permanent.
   */
  it("flags an account squatting an admin address, and still offers to remove it", async () => {
    list.mockResolvedValue({
      rows: [
        account("squatter", {
          email: "squatter@example.com",
          emailVerified: false,
          holdsAdminAddress: true,
        }),
      ],
      total: 1,
    });
    render(<UserManager />);
    await screen.findByText("squatter@example.com");

    expect(
      within(rowFor("squatter@example.com")).getByText("Unclaimed admin address"),
    ).toBeInTheDocument();

    await openActions("squatter@example.com");
    expect(
      screen.getByRole("menuitem", { name: "Delete account" }),
    ).not.toHaveAttribute("aria-disabled", "true");
  });

  it("flags an account whose email is not verified", async () => {
    list.mockResolvedValue({
      rows: [account("new", { email: "new@example.com", emailVerified: false })],
      total: 1,
    });
    render(<UserManager />);
    await screen.findByText("new@example.com");

    expect(
      within(rowFor("new@example.com")).getByText("Unverified"),
    ).toBeInTheDocument();
  });

  /**
   * The server refuses these regardless, but the screen must not offer them:
   * an admin clicking "Delete" and being told no is a worse answer than never
   * being shown the option against an account the allow-list protects.
   */
  it("offers no destructive action against an administrator", async () => {
    render(<UserManager />);
    await screen.findByText("boss@example.com");
    await openActions("boss@example.com");

    expect(
      screen.getByRole("menuitem", { name: "Delete account" }),
    ).toHaveAttribute(...DISABLED);
    expect(
      screen.getByRole("menuitem", { name: "Sign out everywhere" }),
    ).toHaveAttribute(...DISABLED);
  });

  it("offers no sign-out for an account with nothing to sign out", async () => {
    list.mockResolvedValue({
      rows: [account("idle", { email: "idle@example.com", activeSessions: 0 })],
      total: 1,
    });
    render(<UserManager />);
    await screen.findByText("idle@example.com");
    await openActions("idle@example.com");

    expect(
      screen.getByRole("menuitem", { name: "Sign out everywhere" }),
    ).toHaveAttribute(...DISABLED);
    expect(
      screen.getByRole("menuitem", { name: "Delete account" }),
    ).not.toHaveAttribute("aria-disabled", "true");
  });

  it("deletes a client only after the confirmation is accepted", async () => {
    render(<UserManager />);
    await screen.findByText("client@example.com");

    await openActions("client@example.com");
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete account" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(remove).not.toHaveBeenCalled();

    await openActions("client@example.com");
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete account" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith({ id: "client" }));
    // The listing is re-read, so the deleted row can't linger on screen.
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Deleted client@example.com/)).toBeInTheDocument();
  });

  it("revokes sessions and says how many went", async () => {
    render(<UserManager />);
    await screen.findByText("client@example.com");

    await openActions("client@example.com");
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Sign out everywhere" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(revoke).toHaveBeenCalledWith({ id: "client" }));
    expect(await screen.findByText(/2 session/)).toBeInTheDocument();
  });

  it("reports a failed delete instead of pretending it worked", async () => {
    remove.mockRejectedValue(new Error("nope"));
    render(<UserManager />);
    await screen.findByText("client@example.com");

    await openActions("client@example.com");
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete account" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      await screen.findByText(/Could not delete client@example.com/),
    ).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("searches, and resets to the first page when the term changes", async () => {
    render(<UserManager />);
    await screen.findByText("client@example.com");

    await userEvent.type(screen.getByPlaceholderText("Search name or email…"), "ada");

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: "ada", offset: 0 }),
      ),
    );
  });

  it("narrows to unverified accounts", async () => {
    render(<UserManager />);
    await screen.findByText("client@example.com");

    await userEvent.click(screen.getByLabelText("Filter by verification"));
    await userEvent.click(screen.getByRole("option", { name: "Unverified email" }));

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ verified: false }),
      ),
    );
  });

  it("narrows to blocked accounts", async () => {
    render(<UserManager />);
    await screen.findByText("client@example.com");

    await userEvent.click(screen.getByLabelText("Filter by status"));
    await userEvent.click(screen.getByRole("option", { name: "Blocked" }));

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ blocked: true }),
      ),
    );
  });
});

describe("UserManager blocking", () => {
  it("shows a blocked account, with the reason and expiry on the badge", async () => {
    list.mockResolvedValue({
      rows: [
        account("banned", {
          email: "banned@example.com",
          blocked: true,
          blockedReason: "Spamming the library",
          blockedUntil: "2026-03-01T12:00:00.000Z",
        }),
      ],
      total: 1,
    });
    render(<UserManager />);
    await screen.findByText("banned@example.com");

    const badge = within(rowFor("banned@example.com")).getByText("Blocked");
    expect(badge).toHaveAttribute(
      "title",
      expect.stringContaining("Spamming the library"),
    );
    expect(badge).toHaveAttribute("title", expect.stringContaining("until"));
  });

  /**
   * The two states are unrelated and the screen must keep them apart: a block
   * is a decision an admin made, a lockout is the automatic sign-in backoff
   * that anyone can run up against an address and that clears itself.
   */
  it("shows a locked-out account as locked out, not blocked", async () => {
    list.mockResolvedValue({
      rows: [
        account("locked", { email: "locked@example.com", signInLockSeconds: 300 }),
      ],
      total: 1,
    });
    render(<UserManager />);
    await screen.findByText("locked@example.com");

    const row = rowFor("locked@example.com");
    expect(within(row).getByText("Locked out")).toBeInTheDocument();
    expect(within(row).queryByText("Blocked")).not.toBeInTheDocument();
  });

  it("shows an account with neither as active", async () => {
    render(<UserManager />);
    await screen.findByText("client@example.com");
    expect(
      within(rowFor("client@example.com")).getByText("Active"),
    ).toBeInTheDocument();
  });

  it("blocks with the chosen duration and reason", async () => {
    render(<UserManager />);
    await screen.findByText("client@example.com");

    await openActions("client@example.com");
    await userEvent.click(screen.getByRole("menuitem", { name: "Block account…" }));
    await userEvent.type(screen.getByLabelText("Reason (optional)"), "Abuse");
    await userEvent.click(screen.getByLabelText("Duration"));
    await userEvent.click(screen.getByRole("option", { name: "7 days" }));
    await userEvent.click(screen.getByRole("button", { name: "Block" }));

    await waitFor(() =>
      expect(block).toHaveBeenCalledWith({
        id: "client",
        reason: "Abuse",
        days: 7,
      }),
    );
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it("blocks indefinitely when no duration is chosen", async () => {
    render(<UserManager />);
    await screen.findByText("client@example.com");

    await openActions("client@example.com");
    await userEvent.click(screen.getByRole("menuitem", { name: "Block account…" }));
    await userEvent.click(screen.getByRole("button", { name: "Block" }));

    await waitFor(() =>
      expect(block).toHaveBeenCalledWith({
        id: "client",
        reason: undefined,
        days: undefined,
      }),
    );
  });

  it("does not block when the dialog is dismissed", async () => {
    render(<UserManager />);
    await screen.findByText("client@example.com");

    await openActions("client@example.com");
    await userEvent.click(screen.getByRole("menuitem", { name: "Block account…" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(block).not.toHaveBeenCalled();
  });

  it("offers unblock instead of block once an account is blocked", async () => {
    list.mockResolvedValue({
      rows: [account("banned", { email: "banned@example.com", blocked: true })],
      total: 1,
    });
    render(<UserManager />);
    await screen.findByText("banned@example.com");

    await openActions("banned@example.com");
    expect(
      screen.queryByRole("menuitem", { name: "Block account…" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "Unblock account" }));
    await userEvent.click(screen.getByRole("button", { name: "Unblock" }));

    await waitFor(() => expect(unblock).toHaveBeenCalledWith({ id: "banned" }));
    expect(await screen.findByText(/Unblocked banned@example.com/)).toBeInTheDocument();
  });

  it("clears a sign-in lock, and offers it only when one is running", async () => {
    list.mockResolvedValue({
      rows: [
        account("locked", { email: "locked@example.com", signInLockSeconds: 300 }),
        account("free", { email: "free@example.com" }),
      ],
      total: 2,
    });
    render(<UserManager />);
    await screen.findByText("locked@example.com");

    await openActions("free@example.com");
    expect(
      screen.getByRole("menuitem", { name: "Clear sign-in lock" }),
    ).toHaveAttribute(...DISABLED);
    await userEvent.keyboard("{Escape}");

    await openActions("locked@example.com");
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Clear sign-in lock" }),
    );

    await waitFor(() => expect(clearLock).toHaveBeenCalledWith({ id: "locked" }));
    expect(
      await screen.findByText(/Cleared the sign-in lock on locked@example.com/),
    ).toBeInTheDocument();
  });

  /**
   * Admin-ness is the allow-list, not a role stored here, so this screen has
   * no way to grant or revoke it — and blocking an admin would be exactly that
   * in reverse. The server refuses it too.
   */
  it("offers no block against an administrator", async () => {
    render(<UserManager />);
    await screen.findByText("boss@example.com");
    await openActions("boss@example.com");

    expect(
      screen.getByRole("menuitem", { name: "Block account…" }),
    ).toHaveAttribute(...DISABLED);
  });

  /**
   * The mirror of the case above. The guard on an admin row exists to stop
   * this screen removing an administrator's access, so it must not also
   * withhold the two actions that only ever restore it — that would leave an
   * administrator locked out with no way back.
   */
  it("still offers the restorative actions against an administrator", async () => {
    list.mockResolvedValue({
      rows: [
        account("boss", {
          email: "boss@example.com",
          isAdmin: true,
          blocked: true,
          signInLockSeconds: 300,
        }),
      ],
      total: 1,
    });
    render(<UserManager />);
    await screen.findByText("boss@example.com");
    await openActions("boss@example.com");

    expect(
      screen.getByRole("menuitem", { name: "Unblock account" }),
    ).not.toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("menuitem", { name: "Clear sign-in lock" }),
    ).not.toHaveAttribute("aria-disabled", "true");
  });

  it("reports a failed block instead of pretending it worked", async () => {
    block.mockRejectedValue(new Error("nope"));
    render(<UserManager />);
    await screen.findByText("client@example.com");

    await openActions("client@example.com");
    await userEvent.click(screen.getByRole("menuitem", { name: "Block account…" }));
    await userEvent.click(screen.getByRole("button", { name: "Block" }));

    expect(
      await screen.findByText(/Could not block client@example.com/),
    ).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(1);
  });
});
