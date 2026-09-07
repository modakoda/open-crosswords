import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EntryManager } from "./EntryManager";

vi.mock("@/lib/orpc/client", () => ({
  orpc: { admin: { entries: { list: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() } } },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { orpc } = await import("@/lib/orpc/client");
const { toast } = await import("sonner");
const list = vi.mocked(orpc.admin.entries.list);
const remove = vi.mocked(orpc.admin.entries.delete);
const removeMany = vi.mocked(orpc.admin.entries.deleteMany);

const languages = [
  { code: "en", name: "English" },
  { code: "lt", name: "Lietuvių" },
];

function entry(id: string, languageCode: string, clue: string) {
  return {
    id,
    languageCode,
    categoryName: "Geography",
    clue,
    answer: "Paris",
    answerNormalized: "PARIS",
    difficulty: 3,
    enabled: 1,
    categoryId: null,
    length: 5,
    timesUsed: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
}

const rows = [entry("1", "en", "Capital of France"), entry("2", "lt", "Prancūzijos sostinė")];

function renderManager() {
  return render(
    <EntryManager
      language="en"
      languages={languages}
      categories={[]}
      onCategoriesChanged={() => {}}
    />,
  );
}

describe("EntryManager language filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    list.mockResolvedValue({ rows, total: rows.length });
  });

  it("starts scoped to the working language", async () => {
    renderManager();
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(list.mock.calls[0][0]).toMatchObject({ languageCode: "en" });
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

  it("shows each row's own language, even while scoped to one language", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(screen.getByText("Capital of France")).toBeInTheDocument());
    expect(screen.getByRole("columnheader", { name: "Lang" })).toBeInTheDocument();
    expect(
      within(screen.getByText("Capital of France").closest("tr")!).getByText("en"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Filter by language" }));
    await user.click(screen.getByRole("option", { name: "All languages" }));

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("columnheader", { name: "Lang" })).toBeInTheDocument();
    const row = screen.getByText("Prancūzijos sostinė").closest("tr")!;
    expect(within(row).getByText("lt")).toBeInTheDocument();
  });

  it("narrows to one language when that language is picked", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(list).toHaveBeenCalled());

    await user.click(screen.getByRole("combobox", { name: "Filter by language" }));
    await user.click(screen.getByRole("option", { name: "Lietuvių (lt)" }));

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(list.mock.calls[1][0]).toMatchObject({ languageCode: "lt" });
  });
});

describe("EntryManager pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    list.mockResolvedValue({ rows, total: 120 });
  });

  it("requests the first page at the default size", async () => {
    renderManager();
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(list.mock.calls[0][0]).toMatchObject({ limit: 50, offset: 0 });
    expect(screen.getByText("Showing 1–50 of 120")).toBeInTheDocument();
  });

  it("advances the offset when the next page is requested", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(list).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(list.mock.calls[1][0]).toMatchObject({ limit: 50, offset: 50 });
    expect(screen.getByText("Showing 51–100 of 120")).toBeInTheDocument();
  });

  it("disables paging past either end of the listing", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled(),
    );
    expect(screen.getByText("Showing 101–120 of 120")).toBeInTheDocument();
  });

  it("returns to the first page when the page size changes", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(list).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole("combobox", { name: "Rows per page" }));
    await user.click(screen.getByRole("option", { name: "25 / page" }));

    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
    expect(list.mock.calls[2][0]).toMatchObject({ limit: 25, offset: 0 });
  });

  it("returns to the first page when the search term changes", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(list).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));

    await user.type(screen.getByPlaceholderText("Search clue or answer…"), "a");

    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
    expect(list.mock.calls[2][0]).toMatchObject({ q: "a", offset: 0 });
  });

  it("returns to the first page when the language filter changes", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(list).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole("combobox", { name: "Filter by language" }));
    await user.click(screen.getByRole("option", { name: "All languages" }));

    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
    expect(list.mock.calls[2][0]).toMatchObject({ offset: 0 });
  });

  it("steps back when a delete empties the last page", async () => {
    const user = userEvent.setup();
    remove.mockResolvedValue({ deleted: true });
    renderManager();
    await waitFor(() => expect(list).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(screen.getByText("Showing 101–120 of 120")).toBeInTheDocument());

    // The reload after the delete finds only 100 rows, leaving page 3 past the end.
    list.mockResolvedValue({ rows, total: 100 });
    const row = screen.getByText("Capital of France").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Row actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.getByText("Showing 51–100 of 100")).toBeInTheDocument());
  });
});

describe("EntryManager bulk delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    list.mockResolvedValue({ rows, total: rows.length });
    removeMany.mockResolvedValue({ deleted: 2 });
  });

  async function selectRow(user: ReturnType<typeof userEvent.setup>, clue: string) {
    const row = screen.getByText(clue).closest("tr")!;
    await user.click(within(row).getByRole("checkbox", { name: `Select ${clue}` }));
  }

  it("offers no bulk action until a row is selected", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(screen.getByText("Capital of France")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Delete selected" })).not.toBeInTheDocument();

    await selectRow(user, "Capital of France");
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete selected" })).toBeInTheDocument();
  });

  it("selects and clears every visible row at once", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(screen.getByText("Capital of France")).toBeInTheDocument());

    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
  });

  it("confirms before deleting, and deletes nothing if the dialog is cancelled", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(screen.getByText("Capital of France")).toBeInTheDocument());

    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    await user.click(screen.getByRole("button", { name: "Delete selected" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Delete 2 entries?");
    expect(removeMany).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(removeMany).not.toHaveBeenCalled();
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });

  it("deletes the selected ids once confirmed, then reloads and clears", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("checkbox", { name: "Select all rows" }));
    await user.click(screen.getByRole("button", { name: "Delete selected" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => expect(removeMany).toHaveBeenCalledWith({ ids: ["1", "2"] }));
    expect(toast.success).toHaveBeenCalledWith("Deleted 2 entries");
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
  });

  it("keeps the selection and reports a failed delete", async () => {
    const user = userEvent.setup();
    removeMany.mockRejectedValue(new Error("nope"));
    renderManager();
    await waitFor(() => expect(screen.getByText("Capital of France")).toBeInTheDocument());

    await selectRow(user, "Capital of France");
    await user.click(screen.getByRole("button", { name: "Delete selected" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Failed to delete the selected entries"),
    );
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("drops the selection when the listing changes underneath it", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(screen.getByText("Capital of France")).toBeInTheDocument());
    await selectRow(user, "Capital of France");
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    list.mockResolvedValue({ rows: [entry("3", "en", "Another clue")], total: 1 });
    await user.click(screen.getByRole("combobox", { name: "Filter by language" }));
    await user.click(screen.getByRole("option", { name: "All languages" }));

    await waitFor(() => expect(screen.getByText("Another clue")).toBeInTheDocument());
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
  });
});
