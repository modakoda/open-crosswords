import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { UserMenu } from "./user-menu";
import { getMessages } from "@/lib/i18n";

const push = vi.fn();
const refresh = vi.fn();
let session: { data: unknown } = { data: null };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/auth-client", () => ({
  signOut: vi.fn(),
  useSession: () => session,
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const { signOut } = await import("@/lib/auth-client");
const { toast } = await import("sonner");
const t = getMessages("en").header;

async function openMenu(isAdmin = false) {
  const user = userEvent.setup();
  render(<UserMenu messages={t} isAdmin={isAdmin} />);
  await user.click(screen.getByRole("button", { name: t.account }));
  return user;
}

describe("UserMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session = { data: { user: { email: "someone@example.com" } } };
  });

  it("gathers the account's address and sign-out behind one menu", async () => {
    await openMenu();
    expect(screen.getByText("someone@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: t.signOut })).toBeInTheDocument();
    // The visitor's own destination stays in the header's nav.
    expect(screen.queryByRole("menuitem", { name: t.nav.client })).toBeNull();
  });

  it("hides the admin entry from non-admins", async () => {
    await openMenu(false);
    expect(screen.queryByRole("menuitem", { name: t.nav.admin })).toBeNull();
  });

  it("offers the admin entry to admins", async () => {
    await openMenu(true);
    expect(screen.getByRole("menuitem", { name: t.nav.admin })).toHaveAttribute(
      "href",
      "/admin/dashboard",
    );
  });

  it("offers sign-in and sign-up instead when signed out", async () => {
    session = { data: null };
    await openMenu(true);
    expect(screen.getByRole("menuitem", { name: t.nav.signIn })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: t.signUp })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: t.signOut })).toBeNull();
  });

  it("leaves the page and re-renders the server tree after signing out", async () => {
    vi.mocked(signOut).mockResolvedValue({ data: { success: true }, error: null });
    const user = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: t.signOut }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(refresh).toHaveBeenCalled();
  });

  it("stays put when sign-out is rejected, rather than implying the session ended", async () => {
    vi.mocked(signOut).mockResolvedValue({
      data: null,
      error: { status: 429, message: "Too many requests" },
    });
    const user = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: t.signOut }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(t.signOutFailed));
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
