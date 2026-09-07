import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ClientDashboard } from "./ClientDashboard";
import { getMessages } from "@/lib/i18n";

const t = getMessages("en").client;

describe("ClientDashboard", () => {
  it("points an empty account at the generator", () => {
    render(<ClientDashboard puzzles={[]} messages={t} />);
    expect(screen.getByText(t.empty)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.generateCta })).toHaveAttribute(
      "href",
      "/public",
    );
  });

  it("links each saved puzzle to its solver", () => {
    render(
      <ClientDashboard
        puzzles={[
          {
            slug: "amber-quiet-otter-canyon-48392174",
            title: "Amber quiet otter canyon",
            languageCode: "en",
            createdAt: "2026-01-01T00:00:00Z",
          },
        ]}
        messages={t}
      />,
    );
    expect(screen.getByRole("link", { name: t.continueSolving })).toHaveAttribute(
      "href",
      "/public/puzzles/amber-quiet-otter-canyon-48392174",
    );
  });

  it("leaves signing out to the header's user menu", () => {
    render(<ClientDashboard puzzles={[]} messages={t} />);
    expect(screen.queryByRole("button", { name: t.signOut })).toBeNull();
  });
});
