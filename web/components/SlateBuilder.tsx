"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MARKETS, ROUND } from "@/lib/round";
import { short } from "@/lib/proof";
import { explorer } from "@/lib/chain";
import DevnetStatus from "@/components/DevnetStatus";

const WEIGHTS = [10, 20, 30];

export default function SlateBuilder() {
  const [picks, setPicks] = useState<boolean[]>(MARKETS.map(() => true));
  const [weights, setWeights] = useState<number[]>(MARKETS.map(() => 20));
  const [captain, setCaptain] = useState(0);
  const [entered, setEntered] = useState(false);

  const totalWeight = useMemo(
    () => weights.reduce((s, w, i) => s + w * (i === captain ? 2 : 1), 0),
    [weights, captain]
  );

  const setPick = (i: number, v: boolean) => {
    setPicks((p) => p.map((x, j) => (j === i ? v : x)));
    setEntered(false);
  };
  const setWeight = (i: number, w: number) => {
    setWeights((prev) => prev.map((x, j) => (j === i ? w : x)));
    setEntered(false);
  };

  return (
    <div className="panel shadow-panel relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 field-grid opacity-50" />

      {/* round header */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="kicker text-bone">ROUND #{ROUND.id}</span>
          <span className="micro hidden sm:inline">LOCKS AT {ROUND.lockLabel}</span>
        </div>
        <DevnetStatus />
      </div>

      {/* fee strip */}
      <div className="relative grid grid-cols-3 divide-x divide-line border-b border-line">
        <Stat k="ENTRY" v={`${ROUND.entryFee} USDC`} />
        <Stat k="POT" v={`${ROUND.pot} USDC`} />
        <Stat k="PLAYERS" v={String(ROUND.players)} />
      </div>

      {/* markets */}
      <div className="relative divide-y divide-line">
        {MARKETS.map((m, i) => (
          <div key={m.id} className="px-5 py-4 sm:px-8">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="mono text-[10px] text-bone-dim">{String(i + 1).padStart(2, "0")}</span>
                  <span className="display text-[18px] sm:text-[20px]">{m.proposition}</span>
                </div>
                <div className="mono mt-1 text-[11px] text-bone-mute">{m.formula}</div>
              </div>
              <button
                onClick={() => setCaptain(i)}
                className={`mono flex h-6 shrink-0 items-center gap-1 border px-2 text-[10px] tracking-[0.1em] transition-colors ${
                  captain === i
                    ? "border-confirm bg-confirm/10 text-confirm"
                    : "border-line text-bone-dim hover:border-line-strong"
                }`}
                title="captain scores 2×"
              >
                {captain === i ? "★ CAPTAIN 2×" : "☆ CAPTAIN"}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 max-sm:justify-between">
              {/* YES / NO */}
              <div className="inline-flex border border-line">
                {([true, false] as const).map((v) => (
                  <button
                    key={String(v)}
                    onClick={() => setPick(i, v)}
                    className={`kicker px-5 py-2.5 transition-colors sm:px-4 sm:py-1.5 ${
                      picks[i] === v
                        ? v
                          ? "bg-bone text-ink"
                          : "bg-bone text-ink"
                        : "text-bone-dim hover:text-bone"
                    }`}
                  >
                    {v ? "YES" : "NO"}
                  </button>
                ))}
              </div>

              {/* weight */}
              <div className="inline-flex items-center gap-1.5">
                <span className="micro mr-1">WEIGHT</span>
                {WEIGHTS.map((w) => (
                  <button
                    key={w}
                    onClick={() => setWeight(i, w)}
                    className={`mono h-9 w-10 border text-[13px] transition-colors sm:h-7 sm:w-8 sm:text-[12px] ${
                      weights[i] === w
                        ? "border-confirm text-confirm"
                        : "border-line text-bone-dim hover:border-line-strong"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* entry summary */}
      <div className="relative border-t border-line bg-panel2/60 px-5 py-4 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-5 max-sm:w-full max-sm:justify-between max-sm:gap-3">
            <Summ k="MAX SCORE" v={String(totalWeight)} />
            <Summ k="CAPTAIN" v={`M${captain + 1} · 2×`} />
            <Summ k="ESCROW" v={`${ROUND.entryFee} USDC`} />
          </div>
          <button
            onClick={() => setEntered(true)}
            disabled={entered}
            className="kicker inline-flex items-center justify-center gap-2 border border-confirm bg-confirm px-5 py-3 text-ink transition-opacity disabled:opacity-50 max-sm:w-full sm:py-2.5"
          >
            {entered ? "SLATE COMMITTED ✓" : "ENTER SLATE ▸"}
          </button>
        </div>
      </div>

      {/* committed receipt */}
      <AnimatePresence>
        {entered && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative overflow-hidden border-t border-line bg-ink"
          >
            <div className="px-5 py-4 sm:px-8">
              <div className="kicker text-confirm">COMMITTED · {ROUND.entryFee} USDC ESCROWED TO VAULT</div>
              <div className="mono mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-bone-dim">
                <span>
                  picks{" "}
                  <span className="text-bone">
                    {picks.map((p) => (p ? "YES" : "NO")).join(" · ")}
                  </span>
                </span>
                <span>
                  weights <span className="text-bone">[{weights.join(",")}]</span>
                </span>
                <span>
                  captain <span className="text-bone">M{captain + 1}</span>
                </span>
              </div>
              <div className="mono mt-2 text-[11px] text-bone-mute">
                maps to{" "}
                <span className="text-bone-dim">proofxi::enter</span> — USDC → vault PDA ·{" "}
                <a className="text-confirm underline-offset-2 hover:underline" href={explorer(ROUND.program)} target="_blank" rel="noreferrer">
                  program {short(ROUND.program, 4, 4)} ↗
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="px-2 py-3 text-center sm:px-8">
      <div className="micro">{k}</div>
      <div className="display mt-1 text-[20px] sm:text-[26px]">{v}</div>
    </div>
  );
}

function Summ({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col">
      <span className="micro">{k}</span>
      <span className="mono mt-0.5 text-[13px] text-bone">{v}</span>
    </div>
  );
}
