import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getMessages } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n/request";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Open Crosswords",
  description:
    "Generate random, printable crosswords from a multilingual question bank, or solve them online.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();
  const messages = getMessages(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={cn(
          "min-h-dvh font-sans antialiased",
          geistSans.variable,
          geistMono.variable,
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>
            <div className="relative flex min-h-dvh flex-col">
              <SiteHeader messages={messages.header} locale={locale} />
              <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-10">
                {children}
              </main>
              <footer className="no-print border-t border-border/70 py-6">
                <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 text-sm text-muted-foreground sm:flex-row">
                  <p>{messages.footer.tagline}</p>
                  <p>{messages.footer.shareable}</p>
                </div>
              </footer>
            </div>
            <Toaster position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
