import VarReceipt from "@/components/VarReceipt";
import LiveMatchCard from "@/components/LiveMatchCard";
import SlateBuilder from "@/components/SlateBuilder";
import Leaderboard from "@/components/Leaderboard";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-clip">
      <div className="pointer-events-none fixed inset-0 scanline opacity-[0.35]" />

      {/* masthead */}
      <header className="relative border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-baseline gap-3">
            <span className="display text-[26px] tracking-[-0.02em]">PROOF<span className="text-confirm">XI</span></span>
            <span className="micro hidden sm:inline">VAR FOR PREDICTION MARKETS</span>
          </div>
          <nav className="flex items-center gap-4 sm:gap-5">
            <a className="kicker text-bone-dim transition-colors hover:text-bone" href="#live">LIVE</a>
            <a className="kicker text-bone-dim transition-colors hover:text-bone" href="#review">REVIEW</a>
            <a className="kicker hidden text-bone-dim transition-colors hover:text-bone sm:inline" href="#slate">SLATE</a>
            <a className="kicker hidden text-bone-dim transition-colors hover:text-bone sm:inline" href="#payout">PAYOUT</a>
            <span className="hidden items-center gap-2 sm:flex">
              <span className="livedot" />
              <span className="micro text-confirm">DEVNET LIVE</span>
            </span>
          </nav>
        </div>
      </header>

      {/* statement */}
      <section className="relative mx-auto max-w-6xl px-5 pt-10 sm:px-8 sm:pt-14">
        <p className="kicker text-bone-dim">PREDICTION MARKETS &amp; SETTLEMENT · TXLINE WORLD CUP</p>
        <h1 className="display mt-4 max-w-3xl text-[32px] !leading-[1.16] sm:text-[64px] sm:!leading-[0.98]">
          EVERY RESULT GOES TO <span className="text-confirm">VAR</span>.
          <br className="hidden sm:block" /> THE CHAIN MAKES THE CALL.
        </h1>
        <p className="mt-5 max-w-lg text-[14px] leading-relaxed text-bone-dim sm:text-[15px]">
          A stat finalizes, the market goes to review, and the call is made by a
          proof settled on-chain — not an operator. Final, and impossible to rig.
        </p>
      </section>

      {/* live match — the TxLINE scores stream ticking */}
      <section id="live" className="relative mx-auto max-w-4xl px-5 pt-9 sm:px-8 sm:pt-11">
        <div className="mb-3 flex items-center justify-between">
          <span className="kicker text-bone-dim">01 · LIVE MATCH</span>
          <span className="micro">TXLINE SCORES STREAM</span>
        </div>
        <LiveMatchCard />
      </section>

      {/* the money shot */}
      <section id="review" className="relative mx-auto max-w-4xl px-5 pt-14 sm:px-8 sm:pt-16">
        <div className="mb-3 flex items-center justify-between">
          <span className="kicker text-confirm">02 · THE REVIEW</span>
          <span className="micro">ON-CHAIN · VALIDATE_STAT</span>
        </div>
        <VarReceipt />
      </section>

      {/* slate builder — enter the round, escrow USDC */}
      <section id="slate" className="relative mx-auto max-w-4xl px-5 pt-14 sm:px-8 sm:pt-16">
        <div className="mb-3 flex items-center justify-between">
          <span className="kicker text-bone-dim">03 · BUILD YOUR SLATE</span>
          <span className="micro">CREATE_ROUND · ENTER</span>
        </div>
        <SlateBuilder />
      </section>

      {/* payout + leaderboard */}
      <section id="payout" className="relative mx-auto max-w-4xl px-5 pt-14 sm:px-8 sm:pt-16">
        <div className="mb-3 flex items-center justify-between">
          <span className="kicker text-bone-dim">04 · SETTLEMENT &amp; PAYOUT</span>
          <span className="micro">SCORE · PAYOUT</span>
        </div>
        <Leaderboard />
      </section>

      {/* how it works — thin explainer, not gradient cards */}
      <section id="how" className="relative mx-auto max-w-6xl px-5 pt-24 sm:px-8">
        <div className="rule" />
        <div className="grid gap-px border-line md:grid-cols-3">
          <Explain
            n="01"
            head="THE STAT IS PROVEN"
            body="TxLINE serves a Merkle-proven stat: the leaf, its inclusion path, and the event-stat root — a signed snapshot of what actually happened on the pitch."
          />
          <Explain
            n="02"
            head="THE CHAIN REVIEWS IT"
            body="settle_market rebuilds the market's predicate on-chain and CPIs into validate_stat. The verdict is the program's own return data — no keeper, no trust."
          />
          <Explain
            n="03"
            head="THE CALL IS FINAL"
            body="A valid proof releases escrow to the winners. A tampered one can't recompute the signed root, so the settlement aborts and the cheat is rejected."
          />
        </div>
        <div className="rule" />
      </section>

      <footer className="relative mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="micro">PROOFXI · BUILT ON TXLINE · SOLANA DEVNET</span>
          <span className="mono text-[11px] text-bone-mute">
            settlement you can audit, not a scoreboard you have to trust
          </span>
        </div>
      </footer>
    </main>
  );
}

function Explain({ n, head, body }: { n: string; head: string; body: string }) {
  return (
    <div className="bg-panel p-6 sm:p-7">
      <span className="mono text-[11px] tracking-[0.2em] text-confirm">{n}</span>
      <h3 className="display mt-3 text-[22px]">{head}</h3>
      <p className="mt-3 text-[13px] leading-relaxed text-bone-dim">{body}</p>
    </div>
  );
}
