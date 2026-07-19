import type { Metadata } from "next";
import SlateBuilder from "@/components/SlateBuilder";
import PageNav from "@/components/PageNav";

export const metadata: Metadata = { title: "ProofXI — Build a Slate" };

export default function SlatePage() {
  return (
    <main className="relative mx-auto max-w-4xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
      <div className="mb-3 flex items-center justify-between">
        <span className="kicker text-bone-dim">03 · BUILD YOUR SLATE</span>
        <span className="micro">CREATE_ROUND · ENTER</span>
      </div>
      <SlateBuilder />
      <PageNav
        prev={{ href: "/review", label: "THE REVIEW" }}
        next={{ href: "/payout", label: "SETTLEMENT & PAYOUT" }}
      />
    </main>
  );
}
