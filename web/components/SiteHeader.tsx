"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/live", label: "LIVE", always: true },
  { href: "/review", label: "REVIEW", always: true },
  { href: "/slate", label: "SLATE", always: false },
  { href: "/payout", label: "PAYOUT", always: false },
  { href: "/docs", label: "DOCS", always: true },
];

export default function SiteHeader() {
  const path = usePathname();
  return (
    <header className="relative z-10 border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="display text-[26px] tracking-[-0.02em]">
            PROOF<span className="text-confirm">XI</span>
          </span>
          <span className="micro hidden sm:inline">VAR FOR PREDICTION MARKETS</span>
        </Link>
        <nav className="flex items-center gap-4 sm:gap-5">
          {NAV.map((n) => {
            const active = path === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`kicker transition-colors hover:text-bone ${
                  active ? "text-confirm" : "text-bone-dim"
                } ${n.always ? "" : "hidden sm:inline"}`}
              >
                {n.label}
              </Link>
            );
          })}
          <span className="hidden items-center gap-2 sm:flex">
            <span className="livedot" />
            <span className="micro text-confirm">DEVNET LIVE</span>
          </span>
        </nav>
      </div>
    </header>
  );
}
