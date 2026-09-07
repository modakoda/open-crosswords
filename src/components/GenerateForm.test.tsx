import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GenerateForm } from "./GenerateForm";
import { getMessages } from "@/lib/i18n";

const languages = [
  { code: "en", name: "English" },
  { code: "lt", name: "Lietuvių" },
];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/orpc/client", () => ({
  orpc: {
    languages: { list: vi.fn(async () => ({ languages })) },
    categories: { list: vi.fn(async () => ({ categories: [] })) },
    puzzles: { generate: vi.fn() },
  },
}));

const { orpc } = await import("@/lib/orpc/client");

describe("GenerateForm", () => {
  it("offers a picker that starts on the site locale", async () => {
    render(<GenerateForm initialLocale="lt" />);
    await waitFor(() =>
      expect(orpc.categories.list).toHaveBeenCalledWith({ languageCode: "lt" }),
    );
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.getByText("Lietuvių")).toBeTruthy();
  });

  it("falls back to the first language the library has", async () => {
    vi.mocked(orpc.languages.list).mockResolvedValueOnce({
      languages: [{ code: "en", name: "English" }],
    } as never);
    render(<GenerateForm initialLocale="lt" />);
    await waitFor(() =>
      expect(orpc.categories.list).toHaveBeenCalledWith({ languageCode: "en" }),
    );
  });

  it("follows a site language switch without a reload", async () => {
    // The header's switcher writes the `locale` cookie and calls
    // `router.refresh()`, which re-renders the page server component and hands
    // this one a new `initialLocale` — it never remounts.
    const { rerender } = render(<GenerateForm initialLocale="en" />);
    await waitFor(() =>
      expect(orpc.categories.list).toHaveBeenCalledWith({ languageCode: "en" }),
    );

    rerender(<GenerateForm initialLocale="lt" />);
    await waitFor(() =>
      expect(orpc.categories.list).toHaveBeenCalledWith({ languageCode: "lt" }),
    );
    expect(
      screen.getByText(getMessages("lt").generateForm.formTitle),
    ).toBeTruthy();
  });

  it("keeps a content language the visitor picked themselves", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<GenerateForm initialLocale="en" />);
    await waitFor(() =>
      expect(orpc.categories.list).toHaveBeenCalledWith({ languageCode: "en" }),
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Lietuvių" }));
    await waitFor(() =>
      expect(orpc.categories.list).toHaveBeenCalledWith({ languageCode: "lt" }),
    );
    const callsAfterPick = vi.mocked(orpc.categories.list).mock.calls.length;

    // The site locale moving around no longer steers the puzzle language.
    rerender(<GenerateForm initialLocale="lt" />);
    rerender(<GenerateForm initialLocale="en" />);
    await waitFor(() => expect(screen.getByRole("combobox")).toBeTruthy());
    expect(vi.mocked(orpc.categories.list).mock.calls.length).toBe(
      callsAfterPick,
    );
  });

  it("explains when the library has no languages at all", async () => {
    vi.mocked(orpc.languages.list).mockResolvedValueOnce({
      languages: [],
    } as never);
    render(<GenerateForm initialLocale="lt" />);
    expect(
      await screen.findByText(getMessages("lt").generateForm.noLanguages),
    ).toBeTruthy();
  });
});
