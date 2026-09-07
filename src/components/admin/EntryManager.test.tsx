import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EntryManager } from "./EntryManager";
import type { Category } from "./workspace";

vi.mock("@/lib/orpc/client", () => ({
  orpc: {
    admin: {
      entries: { list: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(), update: vi.fn(), create: vi.fn() },
      categories: { create: vi.fn() },
    },
    categories: { list: vi.fn() },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { orpc } = await import("@/lib/orpc/client");
const { toast } = await import("sonner");
const list = vi.mocked(orpc.admin.entries.list);
const remove = vi.mocked(orpc.admin.entries.delete);
const removeMany = vi.mocked(orpc.admin.entries.deleteMany);
const listCategories = vi.mocked(orpc.categories.list);
const update = vi.mocked(orpc.admin.entries.update);
const createCategory = vi.mocked(orpc.admin.categories.create);

const languages = [
  { code: "en", name: "English" },
  { code: "lt", name: "Lietuvių" },
];

const GEOGRAPHY = "11111111-1111-4111-8111-111111111111";
const HISTORY = "22222222-2222-4222-8222-222222222222";

function category(id: string, name: string, languageCode = "en") {
  return {
    id,
    languageCode,
    slug: name.toLowerCase(),
    name,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
}

const enCategories = [category(GEOGRAPHY, "Geography"), category(HISTORY, "History")];

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
    source: "manual",
    timesUsed: 0,
    lastUsedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

const rows = [entry("1", "en", "Capital of France"), entry("2", "lt", "Prancūzijos sostinė")];

const languageChanged = vi.fn();

/**
 * Stands in for `AdminShell`: the working language lives above the manager (in
 * the URL there, in state here), and the categories handed down are always the
 * ones belonging to it.
 */
function Harness({ byLanguage }: { byLanguage: Record<string, Category[]> }) {
  const [language, setLanguage] = useState("en");
  return (
    <EntryManager
      language={language}
      languages={languages}
      categories={byLanguage[language] ?? []}
      onLanguageChange={(code) => {
        languageChanged(code);
        setLanguage(code);
      }}
      onCategoriesChanged={() => {}}
    />
  );
}

function renderManager(
  categories: Category[] = [],
  byLanguage: Record<string, Category[]> = {},
) {
  return render(<Harness byLanguage={{ en: categories, ...byLanguage }} />);
}

/** The listing opens across every language, so most cases narrow it first. */
async function narrowTo(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("combobox", { name: "Filter by language" }));
  await user.click(screen.getByRole("option", { name }));
}

describe("EntryManager language filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCategories.mockResolvedValue({ categories: [] });
    list.mockResolvedValue({ rows, total: rows.length });
  });

  it("starts across every language, not scoped to the working one", async () => {
    renderManager();
    await waitFor(() => expect(list).toHaveBeenCalled());
    // The working language says what a *new* entry is created in; filtering
    // the listing to it on arrival would hide most of the library.
    expect(list.mock.calls[0][0].languageCode).toBeUndefined();
  });

  it("drops the language scope again when every language is selected", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(list).toHaveBeenCalled());

    await narrowTo(user, "Lietuvi\u0173 (lt)");
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(list.mock.calls[1][0]).toMatchObject({ languageCode: "lt" });

    await narrowTo(user, "All languages");

    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
    expect(list.mock.calls[2][0].languageCode).toBeUndefined();
  });

  it("shows each row's own language, even while scoped to one language", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(screen.getByText("Capital of France")).toBeInTheDocument());
    expect(screen.getByRole("columnheader", { name: "Lang" })).toBeInTheDocument();
    expect(
      within(screen.getByText("Prancūzijos sostinė").closest("tr")!).getByText("lt"),
    ).toBeInTheDocument();

    await narrowTo(user, "English (en)");

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("columnheader", { name: "Lang" })).toBeInTheDocument();
    const row = screen.getByText("Capital of France").closest("tr")!;
    expect(within(row).getByText("en")).toBeInTheDocument();
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

  it("moves the dashboard's working language rather than filtering alone", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(list).toHaveBeenCalled());

    await user.click(screen.getByRole("combobox", { name: "Filter by language" }));
    await user.click(screen.getByRole("option", { name: "Lietuvių (lt)" }));

    expect(languageChanged).toHaveBeenCalledWith("lt");
  });

  it("leaves the working language alone when the listing spans every language", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(list).toHaveBeenCalled());

    await narrowTo(user, "English (en)");
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));

    await narrowTo(user, "All languages");

    // "All languages" is a wider view of the listing, not a language a new
    // entry could be created in, so it has nothing to move the working one to.
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
    expect(languageChanged).not.toHaveBeenCalled();
  });
});

describe("EntryManager category filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCategories.mockResolvedValue({ categories: [] });
    list.mockResolvedValue({ rows, total: rows.length });
  });

  it("offers no category filter until the listing is scoped to one language", async () => {
    const user = userEvent.setup();
    renderManager(enCategories);
    await waitFor(() => expect(list).toHaveBeenCalled());
    // Categories belong to a single language, so the listing's opening span
    // over every language leaves no coherent set to offer.
    expect(
      screen.queryByRole("combobox", { name: "Filter by category" }),
    ).not.toBeInTheDocument();

    await narrowTo(user, "English (en)");

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(list.mock.calls[1][0].categoryId).toBeUndefined();
    expect(screen.getByRole("combobox", { name: "Filter by category" })).toBeInTheDocument();
  });

  it("offers no category filter when the language has no categories", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(list).toHaveBeenCalled());

    await narrowTo(user, "English (en)");

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(
      screen.queryByRole("combobox", { name: "Filter by category" }),
    ).not.toBeInTheDocument();
  });

  it("scopes the listing to the picked category, from the first page", async () => {
    const user = userEvent.setup();
    list.mockResolvedValue({ rows, total: 120 });
    renderManager(enCategories);
    await waitFor(() => expect(list).toHaveBeenCalled());
    await narrowTo(user, "English (en)");
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));

    await user.click(screen.getByRole("combobox", { name: "Filter by category" }));
    await user.click(screen.getByRole("option", { name: "History" }));

    await waitFor(() => expect(list).toHaveBeenCalledTimes(4));
    expect(list.mock.calls[3][0]).toMatchObject({ categoryId: HISTORY, offset: 0 });
  });

  it("drops the category filter when the listing spans every language", async () => {
    const user = userEvent.setup();
    renderManager(enCategories);
    await waitFor(() => expect(list).toHaveBeenCalled());
    await narrowTo(user, "English (en)");
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("combobox", { name: "Filter by category" }));
    await user.click(screen.getByRole("option", { name: "Geography" }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));

    await narrowTo(user, "All languages");

    await waitFor(() => expect(list).toHaveBeenCalledTimes(4));
    expect(list.mock.calls[3][0].categoryId).toBeUndefined();
    expect(
      screen.queryByRole("combobox", { name: "Filter by category" }),
    ).not.toBeInTheDocument();
  });

  it("offers the picked language's own categories, without refetching them", async () => {
    const user = userEvent.setup();
    renderManager(enCategories, { lt: [category(HISTORY, "Istorija", "lt")] });
    await waitFor(() => expect(list).toHaveBeenCalled());

    await user.click(screen.getByRole("combobox", { name: "Filter by language" }));
    await user.click(screen.getByRole("option", { name: "Lietuvi\u0173 (lt)" }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));

    // Picking a language here moves the working one, so the shell's own list
    // follows it — the listing has no second set of categories to fetch.
    await user.click(screen.getByRole("combobox", { name: "Filter by category" }));
    expect(screen.getByRole("option", { name: "Istorija" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Geography" })).not.toBeInTheDocument();
    expect(listCategories).not.toHaveBeenCalled();
  });
});

describe("EntryManager pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCategories.mockResolvedValue({ categories: [] });
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

    await narrowTo(user, "Lietuvi\u0173 (lt)");

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
    listCategories.mockResolvedValue({ categories: [] });
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
    await narrowTo(user, "Lietuvi\u0173 (lt)");

    await waitFor(() => expect(screen.getByText("Another clue")).toBeInTheDocument());
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
  });
});

describe("EntryManager entry editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCategories.mockResolvedValue({ categories: [] });
    list.mockResolvedValue({ rows, total: rows.length });
    update.mockResolvedValue({ entry: entry("1", "en", "Capital of France") });
  });

  async function openEditor(user: ReturnType<typeof userEvent.setup>, clue: string) {
    const row = screen.getByText(clue).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Row actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    return screen.findByRole("dialog");
  }

  it("opens the row's values in an edit dialog", async () => {
    const user = userEvent.setup();
    renderManager(enCategories);
    await waitFor(() => expect(screen.getByText("Capital of France")).toBeInTheDocument());

    const dialog = await openEditor(user, "Capital of France");
    expect(within(dialog).getByRole("heading", { name: "Edit entry" })).toBeInTheDocument();
    expect(screen.getByLabelText("Clue")).toHaveValue("Capital of France");
    expect(screen.getByLabelText("Answer")).toHaveValue("Paris");
    expect(screen.getByLabelText("Category (optional)")).toHaveValue("Geography");
  });

  it("patches only that entry, then reloads the listing", async () => {
    const user = userEvent.setup();
    renderManager(enCategories);
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    await openEditor(user, "Capital of France");
    await user.clear(screen.getByLabelText("Clue"));
    await user.type(screen.getByLabelText("Clue"), "French capital");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        id: "1",
        patch: {
          clue: "French capital",
          answer: "Paris",
          difficulty: 3,
          categoryId: GEOGRAPHY,
          languageCode: "en",
        },
      }),
    );
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("clears the category when its name is emptied", async () => {
    const user = userEvent.setup();
    renderManager(enCategories);
    await waitFor(() => expect(screen.getByText("Capital of France")).toBeInTheDocument());

    await openEditor(user, "Capital of France");
    await user.clear(screen.getByLabelText("Category (optional)"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ patch: expect.objectContaining({ categoryId: null }) }),
      ),
    );
    expect(createCategory).not.toHaveBeenCalled();
  });

  it("edits a row in its own language, not the working one", async () => {
    const user = userEvent.setup();
    listCategories.mockResolvedValue({ categories: [category(HISTORY, "Istorija", "lt")] });
    createCategory.mockResolvedValue({ category: category(HISTORY, "Naujas", "lt") });
    renderManager(enCategories);
    await waitFor(() => expect(screen.getByText("Prancūzijos sostinė")).toBeInTheDocument());

    const dialog = await openEditor(user, "Prancūzijos sostinė");
    expect(dialog).toHaveTextContent("Saved to the lt library.");
    await waitFor(() => expect(listCategories).toHaveBeenCalledWith({ languageCode: "lt" }));

    await user.clear(screen.getByLabelText("Category (optional)"));
    await user.type(screen.getByLabelText("Category (optional)"), "Naujas");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(createCategory).toHaveBeenCalledWith({ languageCode: "lt", name: "Naujas" }),
    );
    expect(update.mock.calls[0][0]).toMatchObject({ id: "2" });
  });

  it("keeps the row in its own language unless the picker is changed", async () => {
    const user = userEvent.setup();
    renderManager(enCategories);
    await waitFor(() => expect(screen.getByText("Capital of France")).toBeInTheDocument());

    await openEditor(user, "Capital of France");
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent(
      "English (en)",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ patch: expect.objectContaining({ languageCode: "en" }) }),
      ),
    );
  });

  it("moves an entry to another language, with a category made there", async () => {
    const user = userEvent.setup();
    listCategories.mockResolvedValue({ categories: [category(HISTORY, "Istorija", "lt")] });
    createCategory.mockResolvedValue({ category: category(HISTORY, "Istorija", "lt") });
    renderManager(enCategories);
    await waitFor(() => expect(screen.getByText("Capital of France")).toBeInTheDocument());

    await openEditor(user, "Capital of France");
    await user.click(screen.getByRole("combobox", { name: "Language" }));
    await user.click(screen.getByRole("option", { name: "Lietuvių (lt)" }));

    // The category list follows the language picked, not the row's old one.
    await waitFor(() => expect(listCategories).toHaveBeenCalledWith({ languageCode: "lt" }));

    await user.clear(screen.getByLabelText("Category (optional)"));
    await user.type(screen.getByLabelText("Category (optional)"), "Istorija");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        id: "1",
        patch: {
          clue: "Capital of France",
          answer: "Paris",
          difficulty: 3,
          categoryId: HISTORY,
          languageCode: "lt",
        },
      }),
    );
    // The name already existed in the target language, so nothing was created.
    expect(createCategory).not.toHaveBeenCalled();
  });

  it("offers no language picker when creating — that follows the working language", async () => {
    const user = userEvent.setup();
    renderManager(enCategories);
    await waitFor(() => expect(list).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "New entry" }));
    await screen.findByRole("dialog");
    expect(screen.queryByRole("combobox", { name: "Language" })).not.toBeInTheDocument();
  });

  it("reports a failed save and keeps the dialog open", async () => {
    const user = userEvent.setup();
    update.mockRejectedValue(new Error("Answer must contain 2-21 letters"));
    renderManager(enCategories);
    await waitFor(() => expect(screen.getByText("Capital of France")).toBeInTheDocument());

    await openEditor(user, "Capital of France");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Answer must contain 2-21 letters")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("starts blank again when a new entry follows an edit", async () => {
    const user = userEvent.setup();
    renderManager(enCategories);
    await waitFor(() => expect(screen.getByText("Capital of France")).toBeInTheDocument());

    await openEditor(user, "Capital of France");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "New entry" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "New entry" })).toBeInTheDocument();
    expect(screen.getByLabelText("Clue")).toHaveValue("");
    expect(screen.getByLabelText("Category (optional)")).toHaveValue("");
  });
});
