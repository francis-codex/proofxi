import type { Metadata } from "next";
import Leaderboard from "@/components/Leaderboard";
import PageNav from "@/components/PageNav";

export const metadata: Metadata = { title: "ProofXI — Settlement & Payout" };

export default function PayoutPage() {
  return (
    <main className="relative mx-auto max-w-4xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
      <div className="mb-3 flex items-center justify-between">
        <span className="kicker text-bone-dim">04 · SETTLEMENT &amp; PAYOUT</span>
        <span className="micro">SCORE · PAYOUT</span>
      </div>
      <Leaderboard />
      <PageNav
        prev={{ href: "/slate", label: "BUILD A SLATE" }}
        next={{ href: "/docs", label: "TECHNICAL DOCS" }}
      />
    </main>
  );
}
