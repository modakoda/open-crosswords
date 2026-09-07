import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ClientDashboard } from "./ClientDashboard";
import { getMessages } from "@/lib/i18n";

const deletePuzzle = vi.fn(async (_input: { slug: string }) => ({ deleted: true }));
vi.mock("@/lib/orpc/client", () => ({
  orpc: { client: { puzzles: { delete: (input: { slug: string }) => deletePuzzle(input) } } },
}));

const t = getMessages("en").client;

const saved = {
  slug: "amber-quiet-otter-canyon-48392174",
  title: "Amber quiet otter canyon",
  languageCode: "en",
  createdAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  deletePuzzle.mockReset();
  deletePuzzle.mockResolvedValue({ deleted: true });
});

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
    render(<ClientDashboard puzzles={[saved]} messages={t} />);
    expect(screen.getByRole("link", { name: t.continueSolving })).toHaveAttribute(
      "href",
      "/public/puzzles/amber-quiet-otter-canyon-48392174",
    );
  });

  it("deletes a puzzle only after the confirmation is accepted", async () => {
    const u = userEvent.setup();
    render(<ClientDashboard puzzles={[saved]} messages={t} />);

    await u.click(screen.getByRole("button", { name: `${t.deletePuzzle}: ${saved.title}` }));
    await u.click(screen.getByRole("button", { name: t.cancel }));
    expect(deletePuzzle).not.toHaveBeenCalled();
    expect(screen.getByText(saved.title)).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: `${t.deletePuzzle}: ${saved.title}` }));
    await u.click(screen.getByRole("button", { name: t.deletePuzzle }));

    await waitFor(() => expect(deletePuzzle).toHaveBeenCalledWith({ slug: saved.slug }));
    await waitFor(() => expect(screen.getByText(t.empty)).toBeInTheDocument());
  });

  it("keeps the card and explains itself when the delete fails", async () => {
    deletePuzzle.mockRejectedValue(new Error("nope"));
    const u = userEvent.setup();
    render(<ClientDashboard puzzles={[saved]} messages={t} />);

    await u.click(screen.getByRole("button", { name: `${t.deletePuzzle}: ${saved.title}` }));
    await u.click(screen.getByRole("button", { name: t.deletePuzzle }));

    await waitFor(() => expect(screen.getByText(t.deleteFailed)).toBeInTheDocument());
    expect(screen.getByText(saved.title)).toBeInTheDocument();
  });

  it("leaves signing out to the header's user menu", () => {
    render(<ClientDashboard puzzles={[]} messages={t} />);
    expect(screen.queryByRole("button", { name: t.signOut })).toBeNull();
  });
});
