import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LanguageManager } from "./LanguageManager";

vi.mock("@/lib/orpc/client", () => ({
  orpc: {
    admin: {
      languages: {
        list: vi.fn(),
        create: vi.fn(),
        rename: vi.fn(),
        delete: vi.fn(),
      },
    },
  },
}));

const { orpc } = await import("@/lib/orpc/client");
const list = vi.mocked(orpc.admin.languages.list);
const create = vi.mocked(orpc.admin.languages.create);
const rename = vi.mocked(orpc.admin.languages.rename);
const remove = vi.mocked(orpc.admin.languages.delete);

const createdAt = new Date("2026-01-01T00:00:00Z");
const rows = [
  { code: "en", name: "English", createdAt, entryCount: 12, categoryCount: 3, puzzleCount: 2 },
  { code: "zu", name: "ZU", createdAt, entryCount: 0, categoryCount: 0, puzzleCount: 0 },
];

const onLanguagesChanged = vi.fn();

function renderManager() {
  return render(<LanguageManager onLanguagesChanged={onLanguagesChanged} />);
}

describe("LanguageManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    list.mockResolvedValue({ languages: rows });
  });

  it("lists every language with what is filed under it", async () => {
    renderManager();
    expect(await screen.findByText("English")).toBeInTheDocument();
    const zu = screen.getByText("ZU").closest("tr")!;
    // The counts are the point of the listing: a code with nothing under it
    // is one an admin can still safely reconsider.
    expect(zu).toHaveTextContent("zu");
    expect(zu).toHaveTextContent("0");
  });

  it("adds a language", async () => {
    const user = userEvent.setup();
    create.mockResolvedValue({ languages: [] });
    renderManager();
    await screen.findByText("English");

    await user.type(screen.getByLabelText("Code"), "ZU");
    await user.type(screen.getByLabelText("Name (optional)"), "isiZulu");
    await user.click(screen.getByRole("button", { name: /add/i }));

    await waitFor(() =>
      // Lower-cased before it leaves the form, matching LANGUAGE_CODE.
      expect(create).toHaveBeenCalledWith({ code: "zu", name: "isiZulu" }),
    );
    // Both the counted table here and the pickers in the chrome.
    expect(onLanguagesChanged).toHaveBeenCalled();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("omits an empty name rather than sending a blank one", async () => {
    const user = userEvent.setup();
    create.mockResolvedValue({ languages: [] });
    renderManager();
    await screen.findByText("English");

    await user.type(screen.getByLabelText("Code"), "lt");
    await user.click(screen.getByRole("button", { name: /add/i }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ code: "lt", name: undefined }),
    );
  });

  it("reports a rejected add", async () => {
    const user = userEvent.setup();
    create.mockRejectedValue(new Error("bad code"));
    renderManager();
    await screen.findByText("English");

    await user.type(screen.getByLabelText("Code"), "lt");
    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not add that language/i,
    );
  });

  it("does not blame the add when only the refresh afterwards fails", async () => {
    const user = userEvent.setup();
    create.mockResolvedValue({ languages: [] });
    onLanguagesChanged.mockImplementationOnce(() => {
      throw new Error("stale context");
    });
    renderManager();
    await screen.findByText("English");

    await user.type(screen.getByLabelText("Code"), "zu");
    await user.click(screen.getByRole("button", { name: /add/i }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(
      screen.queryByText(/could not add that language/i),
    ).not.toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /added zu, but the screen could not be refreshed/i,
    );
  });

  it("renames a language without touching its code", async () => {
    const user = userEvent.setup();
    rename.mockResolvedValue({ languages: [] });
    renderManager();
    await screen.findByText("English");

    await user.click(screen.getByRole("button", { name: "Rename ZU" }));
    const field = screen.getByLabelText("Name");
    await user.clear(field);
    await user.type(field, "isiZulu");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(rename).toHaveBeenCalledWith({ code: "zu", name: "isiZulu" }),
    );
    expect(onLanguagesChanged).toHaveBeenCalled();
  });

  it("offers removal only for a language with nothing filed under it", async () => {
    renderManager();
    await screen.findByText("English");

    // English has entries and puzzles; ZU has neither.
    expect(screen.queryByRole("button", { name: "Remove English" })).toBeNull();
    expect(screen.getByRole("button", { name: "Remove ZU" })).toBeInTheDocument();
  });

  it("removes a language once the removal is confirmed", async () => {
    const user = userEvent.setup();
    remove.mockResolvedValue({ languages: [] });
    renderManager();
    await screen.findByText("English");

    await user.click(screen.getByRole("button", { name: "Remove ZU" }));
    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith({ code: "zu" }));
    // The pickers elsewhere list the same languages, so they have to hear too.
    expect(onLanguagesChanged).toHaveBeenCalled();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("does not remove anything when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findByText("English");

    await user.click(screen.getByRole("button", { name: "Remove ZU" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(remove).not.toHaveBeenCalled();
  });

  it("reports a refused removal and reloads, since the counts were stale", async () => {
    const user = userEvent.setup();
    remove.mockRejectedValue(new Error("in use"));
    renderManager();
    await screen.findByText("English");

    await user.click(screen.getByRole("button", { name: "Remove ZU" }));
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not remove zu/i,
    );
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });
});
