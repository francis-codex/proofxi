import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ProofXI — Technical Documentation",
  description:
    "How ProofXI settles prediction markets trustlessly: the on-chain proof gate, TxLINE endpoints, Solana programs, and adversarial binding.",
};

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="display mt-14 text-[26px] sm:text-[32px]">{children}</h2>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-bone-dim sm:text-[15px]">
      {children}
    </p>
  );
}
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="mono rounded bg-panel2/70 px-1.5 py-0.5 text-[12px] text-bone">
      {children}
    </code>
  );
}

export default function DocsPage() {
  return (
    <main className="relative mx-auto max-w-4xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
      <span className="kicker text-confirm">TECHNICAL DOCUMENTATION</span>
      <h1 className="display mt-4 text-[38px] leading-[1.05] sm:text-[56px] sm:leading-[0.98]">
        HOW PROOFXI SETTLES A MARKET WITHOUT ANYONE TO TRUST
      </h1>
      <P>
        ProofXI is VAR for prediction markets: a fantasy World Cup pick&apos;em
        where every market outcome goes to an on-chain review that is final and
        cannot be rigged. The result is decided by a cryptographic proof settled
        on-chain — not by an operator. Track:{" "}
        <strong className="text-bone">Prediction Markets &amp; Settlement</strong>{" "}
        (TxODDS World Cup hackathon). Network:{" "}
        <strong className="text-bone">Solana devnet</strong>. Data:{" "}
        <strong className="text-bone">TxLINE</strong>.
      </P>
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
        <a className="kicker text-confirm hover:underline" href="https://proofxi.vercel.app">LIVE APP ↗</a>
        <a className="kicker text-confirm hover:underline" href="https://github.com/francis-codex/proofxi">GITHUB ↗</a>
        <Link className="kicker text-bone-dim hover:text-bone" href="/review">SEE THE REVIEW ↗</Link>
      </div>

      <H>The thesis in one line</H>
      <P>
        <Code>settle_market</Code> rebuilds a market&apos;s predicate{" "}
        <strong className="text-bone">on-chain</strong> from the stored market
        definition, CPIs into TxLINE&apos;s <Code>Txoracle.validate_stat</Code>,
        and records the program&apos;s own <Code>get_return_data</Code> bool as
        the outcome. A settler can supply the bulky Merkle-proof data, but{" "}
        <strong className="text-bone">
          cannot prove one proposition and record another
        </strong>{" "}
        — the predicate (stat keys, operator, comparison, threshold) is
        reconstructed from chain state, not taken from the caller. That is the
        custom check-gate the track asks for, and exactly what the on-screen VAR
        review visualizes.
      </P>

      <H>How it works, end to end</H>
      <ol className="mt-5 space-y-4">
        {[
          ["01 — Real data in", "A live TxLINE scores feed streams over server-sent events until the match finalizes and the stat is sealed, Merkle-proven by TxLINE."],
          ["02 — Build a slate", "Players pick a set of boolean markets, weight them, captain one for 2×, and escrow test-USDC into the round vault (proofxi::enter)."],
          ["03 — The review", "Each outcome is sent to VAR: settle_market rebuilds the predicate and CPIs into validate_stat. A valid proof returns the outcome bool; a tampered one aborts."],
          ["04 — Settlement & payout", "Correct picks score their weight (captain 2×); the pot is paid by proofxi::payout — winner-take-all, ties split, dust stays in the vault."],
        ].map(([t, d]) => (
          <li key={t as string} className="border-l-2 border-line pl-4">
            <div className="kicker text-confirm">{t}</div>
            <div className="mt-1 max-w-2xl text-[14px] leading-relaxed text-bone-dim">{d}</div>
          </li>
        ))}
      </ol>

      <H>TxLINE endpoints used</H>
      <P>Base origin (devnet): <Code>https://txline-dev.txodds.com</Code></P>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border border-line text-left text-[13px]">
          <thead className="text-bone-dim">
            <tr className="border-b border-line">
              <th className="px-4 py-2.5 font-normal">Purpose</th>
              <th className="px-4 py-2.5 font-normal">Method</th>
              <th className="px-4 py-2.5 font-normal">Endpoint</th>
            </tr>
          </thead>
          <tbody className="mono text-bone">
            {[
              ["Guest session (JWT)", "POST", "/auth/guest/start"],
              ["Activate → X-Api-Token", "POST", "/token/activate"],
              ["Fixtures snapshot (?startEpochDay=)", "GET", "/api/fixtures/snapshot"],
              ["Scores snapshot (per fixture)", "GET", "/api/scores/snapshot/{fixtureId}"],
              ["Merkle stat-validation proof", "GET", "/api/scores/stat-validation"],
              ["Real-time scores stream (SSE)", "GET", "/api/scores/stream"],
            ].map(([p, m, e]) => (
              <tr key={e} className="border-b border-line/60">
                <td className="px-4 py-2.5 text-bone-dim">{p}</td>
                <td className="px-4 py-2.5 text-confirm">{m}</td>
                <td className="px-4 py-2.5">{e}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <P>
        On-chain data subscription is via the Txoracle program&apos;s{" "}
        <Code>subscribe</Code> instruction (free World Cup tier:{" "}
        <Code>serviceLevelId=1</Code>, <Code>durationWeeks=4</Code>).
      </P>
      <P>
        <strong className="text-bone">Where each shows up:</strong> the live
        match card mirrors <Code>/api/scores/stream</Code> over a genuine SSE
        endpoint (<Code>/api/stream</Code>, replayed feed on a real transport);
        the VAR receipt renders the actual bytes of a real{" "}
        <Code>/api/scores/stat-validation</Code> proof pulled on devnet (every
        hash on screen is the hex of those bytes); the slate builder and
        leaderboard read the deployed program and test-USDC mint live over
        JSON-RPC.
      </P>

      <H>On-chain programs (Solana devnet)</H>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border border-line text-left text-[13px]">
          <thead className="text-bone-dim">
            <tr className="border-b border-line">
              <th className="px-4 py-2.5 font-normal">Program</th>
              <th className="px-4 py-2.5 font-normal">Address</th>
              <th className="px-4 py-2.5 font-normal">Role</th>
            </tr>
          </thead>
          <tbody className="mono text-bone">
            {[
              ["Txoracle (TxLINE)", "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J", "serves validate_stat; the proof gate"],
              ["proofxi", "3wqZbXRsECPBib3sfuHGFtZis9WP9JENm3JHxqBtgNCE", "rounds, escrow, settlement, payout"],
              ["proof_verifier", "FLfi8rshUqV8cn71Z1nj29bFLmDdAhiHsVBoqLvhia1F", "minimal CPI de-risk (Phase 1)"],
              ["test-USDC mint", "85s4zWGJ5FLSG1RtqiekE5QQBcNwSvtBgmbEy7UwmwDD", "6-decimal devnet SPL, self-serve faucet"],
            ].map(([n, a, r]) => (
              <tr key={a} className="border-b border-line/60 align-top">
                <td className="px-4 py-2.5 text-bone-dim">{n}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-[11px]">{a}</td>
                <td className="px-4 py-2.5 text-bone-dim">{r}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <P>
        <Code>proofxi</Code> instructions: <Code>faucet</Code> ·{" "}
        <Code>create_round</Code> · <Code>enter</Code> ·{" "}
        <Code>settle_market</Code> (the CPI seam) · <Code>score</Code> ·{" "}
        <Code>payout</Code>. Markets are boolean propositions over TxLINE stat
        keys — e.g. home win = <Code>STAT[1002] − STAT[1003] &gt; 0</Code>. Only
        outcomes are proven via <Code>validate_stat</Code>; odds-weights are
        stored game params committed at <Code>enter</Code>.
      </P>

      <H>Adversarial binding (proven on devnet)</H>
      <P>
        <Code>scripts/adversarial.ts</Code> runs three cheats against a live
        round; each reverts on-chain, while the honest settle passes. This is the
        &quot;watch me try to rig it → the chain rejects it&quot; beat, surfaced
        in the receipt&apos;s <strong className="text-overturn">TRY TO RIG IT</strong> toggle.
      </P>
      <ul className="mt-4 space-y-2">
        {[
          ["Tampered stat value", "InvalidStatProof — Txoracle rejects the fake Merkle leaf inside the CPI"],
          ["Swapped stat keys", "StatMismatch — our on-chain predicate binding catches it"],
          ["Injected second stat", "UnexpectedSecondStat — single-stat market rejects the extra input"],
        ].map(([c, r]) => (
          <li key={c as string} className="flex flex-wrap items-baseline gap-x-3 text-[13px]">
            <span className="mono text-overturn">✕</span>
            <span className="text-bone">{c}</span>
            <span className="mono text-[12px] text-bone-mute">→ {r}</span>
          </li>
        ))}
      </ul>

      <H>Frontend &amp; reproduction</H>
      <P>
        Next.js 14 (App Router) · TypeScript · Tailwind v3 · framer-motion,
        deployed on Vercel. The design is World Cup broadcast graphics × a
        settlement terminal. Reproduce the on-chain proof from the repo:
      </P>
      <div className="mt-4 overflow-x-auto">
        <pre className="mono w-full min-w-[520px] border border-line bg-ink p-4 text-[12px] leading-relaxed text-bone-dim">{`npm install                     # anchor, web3.js, spl-token
npm run setup                   # TxLINE auth → subscribe → pull a real proof
npx tsx scripts/verify-proof.ts # replay the proof through validate_stat on devnet
npx tsx scripts/phase3.ts       # create_round → enter → settle (CPI) → payout
npx tsx scripts/adversarial.ts  # three cheats, each reverts on devnet`}</pre>
      </div>

      <H>A note on trust</H>
      <P>
        ProofXI proves that settlement <strong className="text-bone">faithfully
        follows the signed oracle and cannot be tampered</strong> — it removes the
        operator as a point of manipulation. It does not claim the oracle&apos;s
        data mirrors the real world; that is the oracle&apos;s job (the classic
        oracle-trust boundary). On devnet the scorelines are TxLINE demo data, but
        the proofs are genuine signed payloads, re-verified on-chain through{" "}
        <Code>validate_stat</Code>.
      </P>

      <div className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6">
        <Link className="kicker text-confirm hover:underline" href="/review">RUN THE REVIEW ↗</Link>
        <a className="kicker text-bone-dim hover:text-bone" href="https://github.com/francis-codex/proofxi">SOURCE ON GITHUB ↗</a>
      </div>
    </main>
  );
}
