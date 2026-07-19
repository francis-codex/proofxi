import Link from "next/link";

export default function Home() {
  return (
    <main className="relative">
      {/* statement */}
      <section className="relative mx-auto max-w-6xl px-5 pt-10 sm:px-8 sm:pt-16">
        <p className="kicker text-bone-dim">PREDICTION MARKETS &amp; SETTLEMENT · TXLINE WORLD CUP</p>
        <h1 className="display mt-4 max-w-3xl text-[32px] !leading-[1.16] sm:text-[64px] sm:!leading-[0.98]">
          EVERY RESULT GOES TO <span className="text-confirm">VAR</span>.
          <br className="hidden sm:block" /> THE CHAIN MAKES THE CALL.
        </h1>
        <p className="mt-5 max-w-lg text-[14px] leading-relaxed text-bone-dim sm:text-[15px]">
          A stat finalizes, the market goes to review, and the call is made by a
          proof settled on-chain — not an operator. Final, and impossible to rig.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href="/review"
            className="kicker inline-flex items-center gap-2 border border-confirm bg-confirm px-5 py-3 text-ink"
          >
            SEE THE REVIEW ▸
          </Link>
          <Link
            href="/docs"
            className="kicker inline-flex items-center gap-2 border border-line px-5 py-3 text-bone transition-colors hover:border-line-strong"
          >
            TECHNICAL DOCS
          </Link>
        </div>
      </section>

      {/* the four stages, each its own page */}
      <section className="relative mx-auto max-w-6xl px-5 pt-16 sm:px-8 sm:pt-20">
        <div className="mb-4 flex items-center justify-between">
          <span className="kicker text-bone-dim">THE FLOW</span>
          <span className="micro">EACH STAGE IS ITS OWN VIEW</span>
        </div>
        <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          <StageCard href="/live" n="01" head="LIVE MATCH" body="The TxLINE scores stream ticks in over SSE until the stat is sealed." />
          <StageCard href="/review" n="02" head="THE REVIEW" body="Send the stat to VAR — validate_stat confirms it, or rejects a tamper." accent />
          <StageCard href="/slate" n="03" head="BUILD A SLATE" body="Pick, weight, captain, and escrow test-USDC into the round vault." />
          <StageCard href="/payout" n="04" head="SETTLEMENT" body="Every outcome proven on-chain, scored, and paid winner-take-all." />
        </div>
      </section>

      {/* how it works — thin explainer */}
      <section className="relative mx-auto max-w-6xl px-5 pt-20 sm:px-8">
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
    </main>
  );
}

function StageCard({
  href,
  n,
  head,
  body,
  accent,
}: {
  href: string;
  n: string;
  head: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-between gap-6 bg-panel p-6 transition-colors hover:bg-panel2/60 sm:p-7"
    >
      <span className={`mono text-[11px] tracking-[0.2em] ${accent ? "text-confirm" : "text-bone-mute"}`}>{n}</span>
      <div>
        <h3 className="display text-[22px]">{head}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-bone-dim">{body}</p>
        <span className="kicker mt-4 inline-block text-confirm opacity-0 transition-opacity group-hover:opacity-100">
          OPEN ▸
        </span>
      </div>
    </Link>
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
