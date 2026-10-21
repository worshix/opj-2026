import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lithium Plant Site Selection — Zimbabwe",
  description: "Decision support system for siting a lithium processing plant in Zimbabwe",
};

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/sites", label: "Sites" },
  { href: "/mines", label: "Mines" },
  { href: "/criteria", label: "Criteria" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white shadow-lg">
          <div className="mx-auto max-w-6xl px-4 py-4 flex flex-wrap items-center gap-x-8 gap-y-2">
            <Link href="/" className="text-xl font-extrabold tracking-tight">
              LiSelect<span className="text-amber-300">·ZW</span>
            </Link>
            <nav className="flex gap-1">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-white/15"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <span className="ml-auto text-xs text-white/70">
              Lithium processing plant site selection
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
          Design and Make Project — Industrial &amp; Manufacturing Engineering
        </footer>
      </body>
    </html>
  );
}
