import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import Nav from "@/components/nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Attendance",
  description: "RFID attendance dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Nav />
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 sm:px-6">
          {children}
        </main>
        <Toaster
          theme="dark"
          richColors
          toastOptions={{
            classNames: {
              toast: "!bg-surface-raised !border-border !text-foreground",
              actionButton: "!bg-primary !text-primary-foreground",
            },
          }}
        />
      </body>
    </html>
  );
}
