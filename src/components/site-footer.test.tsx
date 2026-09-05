import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SiteFooter } from "./site-footer";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

function renderFooter(locale: Locale = "en") {
  const messages = getMessages(locale);
  render(
    <SiteFooter
      messages={messages.footer}
      source={messages.header.source}
      sourceAria={messages.header.sourceAria}
    />,
  );
  return messages;
}

describe("SiteFooter", () => {
  it("credits modakoda.com with an external link", () => {
    renderFooter();
    const link = screen.getByRole("link", { name: /modakoda\.com/ });
    expect(link).toHaveAttribute("href", "https://modakoda.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("links to the source repository", () => {
    const messages = renderFooter();
    expect(
      screen.getByRole("link", { name: messages.header.sourceAria }),
    ).toHaveAttribute("href", "https://github.com/open-crosswords/open-crosswords");
  });

  it("renders the localised attribution label", () => {
    renderFooter("lt");
    expect(screen.getByText(getMessages("lt").footer.createdBy)).toBeTruthy();
  });
});
