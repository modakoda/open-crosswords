import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

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
  it("uses the site locale as the content language, with no picker", async () => {
    render(<GenerateForm initialLocale="lt" />);
    await waitFor(() =>
      expect(orpc.categories.list).toHaveBeenCalledWith({ languageCode: "lt" }),
    );
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("Lietuvių")).toBeNull();
    expect(screen.queryByText("English")).toBeNull();
  });

  it("explains when the site locale has no clue library yet", async () => {
    vi.mocked(orpc.languages.list).mockResolvedValueOnce({
      languages: [{ code: "en", name: "English" }],
    } as never);
    render(<GenerateForm initialLocale="lt" />);
    expect(
      await screen.findByText(getMessages("lt").generateForm.noLanguages),
    ).toBeTruthy();
  });
});
