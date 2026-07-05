"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Camera, Dumbbell, MessageCircle } from "lucide-react";

const TABS = [
  { href: "/journal", label: "Journal", Icon: CalendarDays },
  { href: "/chat", label: "Coach", Icon: MessageCircle },
  { href: "/exercises", label: "Exos", Icon: Dumbbell },
  { href: "/photos", label: "Photos", Icon: Camera },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="shrink-0 border-t border-zinc-800/60 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-2xl px-2 py-1.5">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="press flex flex-1 flex-col items-center gap-0.5 py-1"
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200 ${
                  active
                    ? "bg-lime-400/15 text-lime-400"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon
                  className="size-5"
                  strokeWidth={active ? 2.5 : 2}
                />
              </span>
              <span
                className={`display text-[11px] font-semibold uppercase tracking-wide transition-colors duration-200 ${
                  active ? "text-lime-400" : "text-zinc-500"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
