import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open Crosswords",
  description:
    "Generate random, printable crosswords from a multilingual question bank, or solve them online.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="no-print border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold">
              Open Crosswords
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/" className="hover:underline">
                Generate
              </Link>
              <Link href="/admin" className="hover:underline">
                Admin
              </Link>
              <a
                href="https://github.com"
                className="text-slate-500 hover:underline"
              >
                Source
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
