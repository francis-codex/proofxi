import type { Metadata } from "next";
import LiveMatchCard from "@/components/LiveMatchCard";
import PageNav from "@/components/PageNav";

export const metadata: Metadata = { title: "ProofXI — Live Match" };

export default function LivePage() {
  return (
    <main className="relative mx-auto max-w-4xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
      <div className="mb-3 flex items-center justify-between">
        <span className="kicker text-bone-dim">01 · LIVE MATCH</span>
        <span className="micro">TXLINE SCORES STREAM</span>
      </div>
      <LiveMatchCard />
      <PageNav
        prev={{ href: "/", label: "HOME" }}
        next={{ href: "/review", label: "THE REVIEW" }}
      />
    </main>
  );
}
