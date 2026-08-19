import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALFAEr — Bored Pile Site Records",
  description:
    "Digital pile logs, daily site reports, concrete overbreak tracking and layout progress for bored piling contracts.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

const NAV = [
  { href: "/", label: "Today" },
  { href: "/piles", label: "Piles" },
  { href: "/overbreak", label: "Overbreak" },
  { href: "/layout", label: "Layout" },
  { href: "/delays", label: "Lost time" },
  { href: "/productivity", label: "Productivity" },
  { href: "/daily", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <Link href="/" className="shrink-0 font-bold tracking-tight">
              ALFA<span className="text-amber-600">Er</span>
            </Link>
            <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <Link href="/piles/new" className="btn-primary shrink-0 !px-3 !py-1.5">
              + Pile log
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
