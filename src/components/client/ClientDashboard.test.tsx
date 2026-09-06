import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ClientDashboard } from "./ClientDashboard";
import { getMessages } from "@/lib/i18n";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/auth-client", () => ({ signOut: vi.fn() }));

const { signOut } = await import("@/lib/auth-client");
const t = getMessages("en").client;

async function clickSignOut() {
  const user = userEvent.setup();
  render(
    <ClientDashboard email="someone@example.com" puzzles={[]} messages={t} />,
  );
  await user.click(screen.getByRole("button", { name: t.signOut }));
}

describe("ClientDashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes to the login page and re-renders the server tree after signing out", async () => {
    vi.mocked(signOut).mockResolvedValue({ data: { success: true }, error: null });
    await clickSignOut();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/client/login"));
    expect(refresh).toHaveBeenCalled();
  });

  it("stays put when sign-out is rejected, rather than implying the session ended", async () => {
    vi.mocked(signOut).mockResolvedValue({
      data: null,
      error: { status: 429, message: "Too many requests" },
    });
    await clickSignOut();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(t.errorGeneric),
    );
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
