import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageBackdrop } from "@/components/page-backdrop";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getAdmin } from "@/lib/auth-guard";
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
  // Resolved server-side from the session + ADMIN_EMAILS allow-list: the header
  // only advertises /admin to actual admins. Purely cosmetic — every admin
  // route and procedure still enforces requireAdmin on its own. Only the
  // boolean crosses to the client; the admin's id/email stay server-side.
  //
  // This makes the layout's output viewer-dependent, so it must never be
  // publicly cached (no `force-static`/`Cache-Control: public` on pages using
  // it) — `getRequestLocale` already keeps every render request-dynamic.
  // Fail closed if the session lookup throws (e.g. the DB is unreachable), so
  // a blip degrades to "not an admin" instead of 500-ing every page.
  const isAdmin = await getAdmin()
    .then((admin) => admin !== null)
    .catch(() => false);

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
            <PageBackdrop />
            <div className="relative z-10 flex min-h-dvh flex-col">
              <SiteHeader messages={messages.header} locale={locale} isAdmin={isAdmin} />
              <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
                {children}
              </main>
              <SiteFooter
                messages={messages.footer}
                source={messages.header.source}
                sourceAria={messages.header.sourceAria}
              />
            </div>
            <Toaster position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
