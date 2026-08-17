"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, CalendarClock } from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/students", label: "Students", icon: Users },
  { href: "/events", label: "Events", icon: CalendarClock },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface">
      <div className="w-full max-w-5xl mx-auto flex items-center gap-6 px-4 py-3 sm:px-6">
        <span className="font-semibold tracking-tight text-primary">
          Attendance
        </span>
        <nav className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-muted hover:bg-surface-raised hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
