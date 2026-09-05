import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LanguageSwitcher } from "./language-switcher";
import { getMessages, localeNames } from "@/lib/i18n";

const setLocale = vi.hoisted(() => vi.fn(async () => {}));
const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/i18n/actions", () => ({ setLocale }));

const ariaLabel = getMessages("en").header.language;

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    setLocale.mockClear();
    refresh.mockClear();
  });

  it("labels the trigger with the current locale", () => {
    render(<LanguageSwitcher currentLocale="lt" ariaLabel={ariaLabel} />);
    const trigger = screen.getByRole("button", {
      name: `${ariaLabel}: ${localeNames.lt}`,
    });
    expect(trigger).toHaveTextContent("lt");
  });

  it("persists the picked locale and refreshes the server components", async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher currentLocale="en" ariaLabel={ariaLabel} />);

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByRole("menuitem", { name: localeNames.lt }));

    expect(setLocale).toHaveBeenCalledWith("lt");
    expect(refresh).toHaveBeenCalled();
  });

  it("ignores picking the locale that is already active", async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher currentLocale="en" ariaLabel={ariaLabel} />);

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByRole("menuitem", { name: localeNames.en }));

    expect(setLocale).not.toHaveBeenCalled();
  });
});
