import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AdminShell } from "./AdminShell";
import { useAdminWorkspace } from "./workspace";

const replace = vi.fn();
let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/dashboard/entries",
  useSearchParams: () => search,
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({ signOut: vi.fn() }));

vi.mock("@/lib/orpc/client", () => ({
  orpc: {
    languages: { list: vi.fn() },
    categories: { list: vi.fn() },
    admin: { languages: { create: vi.fn() } },
  },
}));

const { orpc } = await import("@/lib/orpc/client");
const listLanguages = vi.mocked(orpc.languages.list);
const listCategories = vi.mocked(orpc.categories.list);

const createdAt = new Date("2026-01-01T00:00:00Z");
const languages = [
  { code: "en", name: "English", createdAt },
  { code: "lt", name: "Lietuvių", createdAt },
];

/** Reports what the routed views would read out of the shell's context. */
function Probe() {
  const { language, languages: langs } = useAdminWorkspace();
  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="count">{langs.length}</span>
    </div>
  );
}

function renderShell(query = "") {
  search = new URLSearchParams(query);
  return render(
    <AdminShell aiEnabled={false}>
      <Probe />
    </AdminShell>,
  );
}

describe("AdminShell working language", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listLanguages.mockResolvedValue({ languages });
    listCategories.mockResolvedValue({ categories: [] });
  });

  it("takes the working language from the URL", async () => {
    renderShell("lang=lt");
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
    expect(screen.getByTestId("language")).toHaveTextContent("lt");
    expect(replace).not.toHaveBeenCalled();
  });

  it("falls back to the first language and writes it back to the URL", async () => {
    renderShell();
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/dashboard/entries?lang=en", {
        scroll: false,
      }),
    );
    expect(screen.getByTestId("language")).toHaveTextContent("en");
  });

  it("rejects a malformed ?lang= rather than querying with it", async () => {
    renderShell("lang=not-a-language-code");
    await waitFor(() => expect(screen.getByTestId("language")).toHaveTextContent("en"));
    expect(listCategories).not.toHaveBeenCalledWith({
      languageCode: "not-a-language-code",
    });
  });

  it("ignores a well-formed code the library does not have", async () => {
    renderShell("lang=fr");
    await waitFor(() => expect(screen.getByTestId("language")).toHaveTextContent("en"));
  });

  it("loads the categories of the language in the URL", async () => {
    renderShell("lang=lt");
    await waitFor(() =>
      expect(listCategories).toHaveBeenCalledWith({ languageCode: "lt" }),
    );
  });

  it("switching the working language navigates rather than holding local state", async () => {
    const user = userEvent.setup();
    renderShell("lang=en");
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(screen.getByRole("option", { name: "Lietuvių (lt)" }));

    expect(replace).toHaveBeenCalledWith("/admin/dashboard/entries?lang=lt", {
      scroll: false,
    });
  });
});
