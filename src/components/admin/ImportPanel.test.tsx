import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ImportPanel } from "./ImportPanel";

vi.mock("@/lib/orpc/client", () => ({
  orpc: { admin: { entries: { import: vi.fn() } } },
}));

const { orpc } = await import("@/lib/orpc/client");
const runImport = vi.mocked(orpc.admin.entries.import);

const JSON_TEXT = '[{"clue":"Capital of France","answer":"Paris"}]';

function renderPanel() {
  return render(<ImportPanel language="en" onDone={() => {}} />);
}

function pick(name: string, content: string) {
  return new File([content], name, { type: "application/json" });
}

describe("ImportPanel file loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runImport.mockResolvedValue({ inserted: 1, skipped: 0, errors: [] });
  });

  it("loads a chosen json file into the textarea and imports it", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.upload(screen.getByLabelText("Choose a JSON or CSV file"), pick("entries.json", JSON_TEXT));

    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(JSON_TEXT));
    expect(screen.getByText("entries.json")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Import$/ }));
    await waitFor(() => expect(runImport).toHaveBeenCalled());
    expect(runImport.mock.calls[0][0]).toMatchObject({
      languageCode: "en",
      format: "json",
      text: JSON_TEXT,
    });
  });

  it("switches the format toggle to match a csv file", async () => {
    const user = userEvent.setup();
    renderPanel();

    const csv = "clue,answer\nFrozen water,Ice";
    await user.upload(screen.getByLabelText("Choose a JSON or CSV file"), pick("entries.csv", csv));

    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(csv));
    await user.click(screen.getByRole("button", { name: /^Import$/ }));
    await waitFor(() => expect(runImport).toHaveBeenCalled());
    expect(runImport.mock.calls[0][0]).toMatchObject({ format: "csv" });
  });

  it("sends a large file as several batches and totals the results", async () => {
    const user = userEvent.setup();
    renderPanel();

    const rows = Array.from({ length: 1200 }, (_, i) => ({
      clue: `Clue number ${i}`,
      answer: `Answer${i}`,
    }));
    runImport.mockResolvedValue({ inserted: 400, skipped: 0, errors: [] });

    await user.upload(
      screen.getByLabelText("Choose a JSON or CSV file"),
      pick("big.json", JSON.stringify(rows)),
    );
    await waitFor(() => expect(screen.getByText("big.json")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /^Import$/ }));
    await waitFor(() => expect(screen.getByText(/Inserted 1200/)).toBeInTheDocument());

    expect(runImport).toHaveBeenCalledTimes(3);
    const sent = runImport.mock.calls.flatMap(
      (call) => JSON.parse(call[0].text as string) as unknown[],
    );
    expect(sent).toEqual(rows);
  });

  it("stops at the first failing batch and reports what got in", async () => {
    const user = userEvent.setup();
    renderPanel();

    const rows = Array.from({ length: 1200 }, (_, i) => ({
      clue: `Clue number ${i}`,
      answer: `Answer${i}`,
    }));
    runImport
      .mockResolvedValueOnce({ inserted: 500, skipped: 0, errors: [] })
      .mockRejectedValueOnce(new Error("Language not found"));

    await user.upload(
      screen.getByLabelText("Choose a JSON or CSV file"),
      pick("big.json", JSON.stringify(rows)),
    );
    await waitFor(() => expect(screen.getByText("big.json")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /^Import$/ }));

    expect(
      await screen.findByText(/Inserted 500.*Stopped early: Language not found/),
    ).toBeInTheDocument();
    expect(runImport).toHaveBeenCalledTimes(2);
  });

  it("reports an unsupported file and leaves the text untouched", async () => {
    const user = userEvent.setup();
    renderPanel();
    const before = (screen.getByRole("textbox") as HTMLTextAreaElement).value;

    await user.upload(screen.getByLabelText("Choose a JSON or CSV file"), pick("entries.txt", JSON_TEXT));

    expect(await screen.findByText("Choose a .json or .csv file")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue(before);
    expect(screen.getByText("No file chosen")).toBeInTheDocument();
  });
});
