import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EntryManager } from "./EntryManager";

vi.mock("@/lib/orpc/client", () => ({
  orpc: { admin: { entries: { list: vi.fn() } } },
}));

const { orpc } = await import("@/lib/orpc/client");
const list = vi.mocked(orpc.admin.entries.list);

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

  it("shows each row's own language once the listing spans languages", async () => {
    const user = userEvent.setup();
    renderManager();
    await waitFor(() => expect(screen.getByText("Capital of France")).toBeInTheDocument());
    expect(screen.queryByRole("columnheader", { name: "Lang" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Filter by language" }));
    await user.click(screen.getByRole("option", { name: "All languages" }));

    await waitFor(() =>
      expect(screen.getByRole("columnheader", { name: "Lang" })).toBeInTheDocument(),
    );
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
