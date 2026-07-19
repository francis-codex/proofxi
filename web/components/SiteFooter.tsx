import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="relative mx-auto max-w-6xl px-5 py-14 sm:px-8">
      <div className="rule mb-8" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="micro">PROOFXI · BUILT ON TXLINE · SOLANA DEVNET</span>
        <Link
          href="/docs"
          className="kicker text-confirm underline-offset-2 hover:underline"
        >
          TECHNICAL DOCS ↗
        </Link>
      </div>
      <p className="mono mt-4 max-w-2xl text-[11px] leading-relaxed text-bone-mute">
        Devnet only. Scorelines are TxLINE devnet demo data — the proofs are
        genuine and verified on-chain; ProofXI proves settlement faithfully
        follows the signed oracle, not that the oracle mirrors any real-world
        result.
      </p>
    </footer>
  );
}
