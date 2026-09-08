import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AdminLanguageBar } from "./AdminLanguageBar";
import { AdminShell } from "./AdminShell";
import { useAdminWorkspace } from "./workspace";

const replace = vi.fn();
let search = new URLSearchParams();
let pathname = "/admin/dashboard/entries";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => search,
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({ signOut: vi.fn() }));

vi.mock("@/lib/orpc/client", () => ({
  orpc: {
    languages: { list: vi.fn() },
    categories: { list: vi.fn() },
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

function renderShell(
  query = "",
  route = "/admin/dashboard/entries",
  children: React.ReactNode = null,
) {
  search = new URLSearchParams(query);
  pathname = route;
  return render(
    <AdminShell aiEnabled={false}>
      <Probe />
      {children}
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
    renderShell("lang=en", "/admin/dashboard/import", <AdminLanguageBar />);
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));

    await user.click(screen.getByRole("combobox", { name: "Working language" }));
    await user.click(screen.getByRole("option", { name: "Lietuvių (lt)" }));

    expect(replace).toHaveBeenCalledWith("/admin/dashboard/import?lang=lt", {
      scroll: false,
    });
  });

  it("leaves adding a language to the languages view, not the chrome", async () => {
    renderShell("lang=en", "/admin/dashboard/entries");
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
    expect(screen.queryByText("Add a language")).not.toBeInTheDocument();
  });

  it("leaves the picker to the view rather than rendering it as chrome", async () => {
    // The listings carry their own "Filter by language"; the chrome carrying a
    // picker as well would be two ways to set one thing.
    for (const route of [
      "/admin/dashboard/entries",
      "/admin/dashboard/puzzles",
      "/admin/dashboard/languages",
      "/admin/dashboard/import",
    ]) {
      const view = renderShell("lang=en", route);
      await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
      expect(
        screen.queryByRole("combobox", { name: "Working language" }),
      ).not.toBeInTheDocument();
      view.unmount();
    }
  });
});
