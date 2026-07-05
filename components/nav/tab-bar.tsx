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
    <nav className="shrink-0 border-t border-zinc-800/80 bg-zinc-950 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition ${
                active ? "text-lime-400" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
