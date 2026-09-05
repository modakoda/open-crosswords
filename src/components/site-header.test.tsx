import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { SiteHeader } from "./site-header";
import { getMessages } from "@/lib/i18n";

const session = { data: null as unknown };

vi.mock("next/navigation", () => ({
  usePathname: () => "/public",
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: () => session,
}));

const messages = getMessages("en").header;

function renderHeader(isAdmin: boolean) {
  render(<SiteHeader messages={messages} locale="en" isAdmin={isAdmin} />);
}

describe("SiteHeader", () => {
  it("hides the admin link when the viewer is not an admin", () => {
    renderHeader(false);
    expect(screen.queryByRole("link", { name: messages.nav.admin })).toBeNull();
  });

  it("shows the admin link when the viewer is an admin", () => {
    renderHeader(true);
    // Rendered twice: desktop nav + the mobile sheet trigger's menu.
    expect(
      screen.getAllByRole("link", { name: messages.nav.admin }).length,
    ).toBeGreaterThan(0);
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
