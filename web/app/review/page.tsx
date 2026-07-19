import type { Metadata } from "next";
import VarReceipt from "@/components/VarReceipt";
import PageNav from "@/components/PageNav";

export const metadata: Metadata = { title: "ProofXI — The Review" };

export default function ReviewPage() {
  return (
    <main className="relative mx-auto max-w-4xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
      <div className="mb-3 flex items-center justify-between">
        <span className="kicker text-confirm">02 · THE REVIEW</span>
        <span className="micro">ON-CHAIN · VALIDATE_STAT</span>
      </div>
      <VarReceipt />
      <PageNav
        prev={{ href: "/live", label: "LIVE MATCH" }}
        next={{ href: "/slate", label: "BUILD A SLATE" }}
      />
    </main>
  );
}
