import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SiteHeader } from "./site-header";
import { getMessages } from "@/lib/i18n";

let session: { data: unknown } = { data: null };

vi.mock("next/navigation", () => ({
  usePathname: () => "/public",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  signOut: vi.fn(),
  useSession: () => session,
}));

const messages = getMessages("en").header;

function renderHeader(isAdmin: boolean, signedIn = false) {
  session = { data: signedIn ? { user: { email: "admin@example.com" } } : null };
  render(<SiteHeader messages={messages} locale="en" isAdmin={isAdmin} />);
}

describe("SiteHeader", () => {
  it("keeps the account itself out of the nav and behind the user menu", () => {
    renderHeader(true, true);
    expect(screen.queryByRole("link", { name: messages.nav.admin })).toBeNull();
    expect(screen.queryByRole("link", { name: messages.nav.signIn })).toBeNull();
    expect(
      screen.getByRole("button", { name: messages.account }),
    ).toBeInTheDocument();
  });

  it("puts the signed-in visitor's puzzles in the nav beside generate", () => {
    renderHeader(false, true);
    expect(
      screen.getAllByRole("link", { name: messages.nav.client })[0],
    ).toHaveAttribute("href", "/client/dashboard");
  });

  it("drops that nav link when nobody is signed in", () => {
    renderHeader(false);
    expect(screen.queryByRole("link", { name: messages.nav.client })).toBeNull();
  });

  it("hides the admin entry from non-admins", async () => {
    const user = userEvent.setup();
    renderHeader(false, true);
    await user.click(screen.getByRole("button", { name: messages.account }));
    expect(screen.queryByRole("menuitem", { name: messages.nav.admin })).toBeNull();
  });

  it("shows the admin entry to admins", async () => {
    const user = userEvent.setup();
    renderHeader(true, true);
    await user.click(screen.getByRole("button", { name: messages.account }));
    expect(
      screen.getByRole("menuitem", { name: messages.nav.admin }),
    ).toBeInTheDocument();
  });

  it("leaves the source link to the footer", () => {
    renderHeader(false);
    expect(screen.queryByRole("link", { name: messages.sourceAria })).toBeNull();
  });

  it("always shows the generate link", () => {
    renderHeader(false);
    expect(
      screen.getAllByRole("link", { name: messages.nav.generate }).length,
    ).toBeGreaterThan(0);
  });
});
