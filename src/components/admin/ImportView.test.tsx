import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ImportView } from "./ImportView";
import { AdminWorkspaceProvider, type AdminWorkspace } from "./workspace";

vi.mock("@/lib/orpc/client", () => ({
  orpc: { admin: { entries: { import: vi.fn() } } },
}));

const setLanguage = vi.fn();

function renderView() {
  const workspace: AdminWorkspace = {
    languages: [
      { code: "en", name: "English" },
      { code: "lt", name: "Lietuvių" },
    ],
    reloadLanguages: vi.fn(),
    language: "en",
    setLanguage,
    categories: [],
    reloadCategories: vi.fn(),
    aiEnabled: false,
  };
  return render(
    <AdminWorkspaceProvider value={workspace}>
      <ImportView />
    </AdminWorkspaceProvider>,
  );
}

describe("ImportView working language", () => {
  it("carries its own picker for the language every imported row lands in", async () => {
    const user = userEvent.setup();
    renderView();

    const picker = screen.getByRole("combobox", { name: "Working language" });
    expect(picker).toHaveTextContent("English (en)");

    // It sits above the paste box it governs, not in the shared chrome.
    const textarea = screen.getByRole("textbox");
    expect(
      picker.compareDocumentPosition(textarea) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.click(picker);
    await user.click(screen.getByRole("option", { name: "Lietuvių (lt)" }));
    expect(setLanguage).toHaveBeenCalledWith("lt");
  });
});
