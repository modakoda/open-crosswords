import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ADMIN_VIEWS, AdminNav } from "./AdminNav";

const pathname = vi.fn(() => "/admin/dashboard/entries");

vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));

describe("AdminNav", () => {
  it("links to every admin view, so each one has its own URL", () => {
    render(<AdminNav language="en" />);
    for (const { segment, label } of ADMIN_VIEWS) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        `/admin/dashboard/${segment}?lang=en`,
      );
    }
  });

  it("marks the view matching the current path as the current page", () => {
    pathname.mockReturnValue("/admin/dashboard/puzzles");
    render(<AdminNav language="en" />);
    expect(screen.getByRole("link", { name: "Puzzles" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Entries" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("carries the working language across views, and omits it when unset", () => {
    pathname.mockReturnValue("/admin/dashboard/entries");
    const { unmount } = render(<AdminNav language="pt-br" />);
    expect(screen.getByRole("link", { name: "Puzzles" })).toHaveAttribute(
      "href",
      "/admin/dashboard/puzzles?lang=pt-br",
    );
    unmount();

    render(<AdminNav language="" />);
    expect(screen.getByRole("link", { name: "Puzzles" })).toHaveAttribute(
      "href",
      "/admin/dashboard/puzzles",
    );
  });
});
