import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PuzzleManager } from "./PuzzleManager";

vi.mock("@/lib/orpc/client", () => ({
  orpc: {
    admin: { puzzles: { list: vi.fn(), delete: vi.fn(), rename: vi.fn() } },
  },
}));

const { orpc } = await import("@/lib/orpc/client");
const list = vi.mocked(orpc.admin.puzzles.list);
const remove = vi.mocked(orpc.admin.puzzles.delete);
const rename = vi.mocked(orpc.admin.puzzles.rename);

const languages = [
  { code: "en", name: "English" },
  { code: "lt", name: "Lietuvių" },
];

function puzzle(id: string, languageCode: string, title: string) {
  return {
    id,
    slug: `slug-${id}`,
    title,
    languageCode,
    paperSize: "a4",
    orientation: "portrait",
    width: 15,
    height: 15,
    wordCount: 12,
    ownerEmail: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

const rows = [puzzle("1", "en", "Animals"), puzzle("2", "lt", "Gyvūnai")];

const renderManager = () => render(<PuzzleManager language="en" languages={languages} />);

describe("PuzzleManager listing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    list.mockResolvedValue({ rows, total: rows.length });
  });

  it("starts scoped to the working language", async () => {
    renderManager();
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(list.mock.calls[0][0]).toMatchObject({ languageCode: "en", limit: 50, offset: 0 });
  });

  it("drops the language scope when every language is selected", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(list).toHaveBeenCalled());

    await user.click(screen.getByRole("combobox", { name: "Filter by language" }));
    await user.click(screen.getByRole("option", { name: "All languages" }));

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(list.mock.calls[1][0].languageCode).toBeUndefined();
  });

  it("shows each puzzle's grid, word count and owner", async () => {
    list.mockResolvedValue({
      rows: [{ ...puzzle("1", "en", "Animals"), ownerEmail: "client@example.com" }],
      total: 1,
    });
    renderManager();

    const row = within(await screen.findByRole("row", { name: /Animals/ }));
    expect(row.getByText("15×15")).toBeInTheDocument();
    expect(row.getByText("12")).toBeInTheDocument();
    expect(row.getByText("client@example.com")).toBeInTheDocument();
    expect(row.getByRole("link", { name: "slug-1" })).toHaveAttribute(
      "href",
      "/public/puzzles/slug-1",
    );
  });

  it("labels an unowned puzzle as anonymous", async () => {
    renderManager();
    const row = within(await screen.findByRole("row", { name: /Animals/ }));
    expect(row.getByText("Anonymous")).toBeInTheDocument();
  });

  it("searches by title or link", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(list).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText("Search title or link…"), "anim");
    await waitFor(() => expect(list.mock.calls.at(-1)![0]).toMatchObject({ q: "anim" }));
  });

  it("reports an empty listing", async () => {
    list.mockResolvedValue({ rows: [], total: 0 });
    renderManager();
    expect(await screen.findByText("No puzzles")).toBeInTheDocument();
  });

  it("surfaces a load failure", async () => {
    list.mockRejectedValue(new Error("boom"));
    renderManager();
    expect(await screen.findByText("Failed to load puzzles")).toBeInTheDocument();
  });

  it("steps back when the current page runs past the end", async () => {
    const user = userEvent.setup();
    list.mockResolvedValue({ rows, total: 120 });
    renderManager();
    await waitFor(() => expect(screen.getByText("Showing 1–50 of 120")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(screen.getByText("Showing 51–100 of 120")).toBeInTheDocument());

    list.mockResolvedValue({ rows, total: 20 });
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    await waitFor(() => expect(screen.getByText("Showing 1–20 of 20")).toBeInTheDocument());
  });
});

describe("PuzzleManager actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    list.mockResolvedValue({ rows, total: rows.length });
    remove.mockResolvedValue({ deleted: true });
    rename.mockResolvedValue({ puzzle: { id: "1", title: "Renamed" } });
  });

  it("deletes only after the confirmation is accepted", async () => {
    const user = userEvent.setup();
    renderManager();
    const row = await screen.findByRole("row", { name: /Animals/ });

    await user.click(within(row).getByRole("button", { name: "Row actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(remove).not.toHaveBeenCalled();

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith({ id: "1" }));
    // The listing reloads so the deleted row leaves the table.
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it("renames a puzzle and reloads the listing", async () => {
    const user = userEvent.setup();
    renderManager();
    const row = await screen.findByRole("row", { name: /Animals/ });

    await user.click(within(row).getByRole("button", { name: "Row actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));

    const field = await screen.findByLabelText("Title");
    expect(field).toHaveValue("Animals");
    await user.clear(field);
    await user.type(field, "Renamed");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(rename).toHaveBeenCalledWith({ id: "1", title: "Renamed" }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it("keeps the dialog open and explains a failed rename", async () => {
    const user = userEvent.setup();
    rename.mockRejectedValue(new Error("boom"));
    renderManager();
    const row = await screen.findByRole("row", { name: /Animals/ });

    await user.click(within(row).getByRole("button", { name: "Row actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));
    await user.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByText("Could not rename that puzzle.")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });
});
