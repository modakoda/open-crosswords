import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ClientAuthForm } from "./ClientAuthForm";
import { getMessages } from "@/lib/i18n";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  signIn: { email: vi.fn() },
  signUp: { email: vi.fn() },
}));

const { signIn } = await import("@/lib/auth-client");
const t = getMessages("en").client;

async function submitLogin() {
  const user = userEvent.setup();
  render(<ClientAuthForm mode="login" messages={t} />);
  await user.type(screen.getByLabelText(t.email), "someone@example.com");
  await user.type(screen.getByLabelText(t.password), "a-password-here");
  await user.click(screen.getByRole("button", { name: t.submitLogin }));
}

describe("ClientAuthForm", () => {
  it("shows one generic message for a rejected credential", async () => {
    vi.mocked(signIn.email).mockResolvedValue({ error: { status: 401 } });
    await submitLogin();
    await waitFor(() =>
      expect(screen.getByText(t.errorCredentials)).toBeInTheDocument(),
    );
  });

  it("tells a locked-out visitor to wait rather than repeating the credential error", async () => {
    vi.mocked(signIn.email).mockResolvedValue({ error: { status: 429 } });
    await submitLogin();
    await waitFor(() =>
      expect(screen.getByText(t.errorTooManyAttempts)).toBeInTheDocument(),
    );
  });
});
