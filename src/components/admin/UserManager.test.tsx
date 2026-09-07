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
      users: { list: vi.fn(), delete: vi.fn(), revokeSessions: vi.fn() },
    },
  },
}));

const { orpc } = await import("@/lib/orpc/client");
const list = vi.mocked(orpc.admin.users.list);
const remove = vi.mocked(orpc.admin.users.delete);
const revoke = vi.mocked(orpc.admin.users.revokeSessions);

function account(
  id: string,
  over: Partial<{
    email: string;
    name: string;
    isAdmin: boolean;
    isPendingAdmin: boolean;
    emailVerified: boolean;
    activeSessions: number;
  }> = {},
) {
  return {
    id,
    name: over.name ?? `User ${id}`,
    email: over.email ?? `${id}@example.com`,
    emailVerified: over.emailVerified ?? true,
    isAdmin: over.isAdmin ?? false,
    isPendingAdmin: over.isPendingAdmin ?? false,
    puzzleCount: 3,
    solveCount: 1,
    activeSessions: over.activeSessions ?? 2,
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
});
