"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MARKETS, ROUND, standings } from "@/lib/round";
import { short } from "@/lib/proof";
import { explorer } from "@/lib/chain";
import DevnetStatus from "@/components/DevnetStatus";

export default function Leaderboard() {
  const rows = standings();
  const [open, setOpen] = useState<string | null>(rows[0]?.handle ?? null);

  return (
    <div className="panel shadow-panel relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 field-grid opacity-50" />

      {/* header */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="kicker text-confirm">SETTLED</span>
          <span className="micro hidden sm:inline">TRUSTLESSLY · VALIDATE_STAT</span>
        </div>
        <DevnetStatus />
      </div>

      {/* resolutions — the verifiable receipt behind each market */}
      <div className="relative border-b border-line">
        <div className="px-5 py-2 sm:px-8">
          <span className="micro">MARKET RESOLUTIONS · EACH PROVEN ON-CHAIN</span>
        </div>
        <div className="divide-y divide-line border-t border-line">
          {MARKETS.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3 sm:px-8">
              <span className="mono w-6 shrink-0 text-[10px] text-bone-dim">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-bone">{m.proposition}</div>
                <div className="mono truncate text-[11px] text-bone-mute">
                  proven vs {short(m.proofHash, 6, 6)}
                </div>
              </div>
              <span className={`mono shrink-0 text-[13px] ${m.outcome ? "text-confirm" : "text-bone-dim"}`}>
                {m.outcome ? "YES" : "NO"}
              </span>
              <span className="mono flex h-6 shrink-0 items-center gap-1.5 border border-confirm/60 px-2 text-[10px] tracking-[0.1em] text-confirm">
                <span className="block h-1.5 w-1.5 rounded-full bg-confirm" /> CONFIRMED
              </span>
              <a
                href={explorer(m.proofHash.startsWith("0x") ? ROUND.program : m.proofHash)}
                target="_blank"
                rel="noreferrer"
                className="mono hidden text-[11px] text-bone-dim underline-offset-2 hover:text-bone hover:underline sm:inline"
              >
                ↗
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* standings */}
      <div className="relative divide-y divide-line">
        {rows.map((r) => {
          const isOpen = open === r.handle;
          return (
            <div key={r.handle}>
              <button
                onClick={() => setOpen(isOpen ? null : r.handle)}
                className="flex w-full items-center gap-2.5 px-5 py-4 text-left transition-colors hover:bg-panel2/40 sm:gap-4 sm:px-8"
              >
                <span className={`display text-[22px] ${r.isWinner ? "text-confirm" : "text-bone-dim"}`}>
                  {r.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[13px] text-bone">{r.handle}</span>
                    {r.isWinner && (
                      <span className="mono border border-confirm px-1.5 text-[9px] tracking-[0.1em] text-confirm">
                        WINNER
                      </span>
                    )}
                  </div>
                  <div className="mono text-[11px] text-bone-mute">
                    captain M{r.captain + 1} · {r.picks.map((p) => (p ? "Y" : "N")).join("")}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="display tabular text-[22px] leading-none sm:text-[26px]">{r.score}</div>
                  <div className="micro mt-1">POINTS</div>
                </div>
                <div className="w-[68px] shrink-0 text-right sm:w-24">
                  <div className={`mono tabular text-[13px] sm:text-[15px] ${r.payout > 0 ? "text-confirm" : "text-bone-mute"}`}>
                    {r.payout > 0 ? `+${r.payout}` : "0"} USDC
                  </div>
                  <div className="micro mt-1">PAYOUT</div>
                </div>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-ink"
                  >
                    <div className="divide-y divide-line border-t border-line">
                      {MARKETS.map((m, i) => {
                        const pick = r.picks[i];
                        const correct = pick === m.outcome;
                        const pts = correct ? r.weights[i] * (i === r.captain ? 2 : 1) : 0;
                        return (
                          <div key={m.id} className="flex items-center gap-3 px-5 py-2.5 sm:px-8">
                            <span className="mono w-6 shrink-0 text-[10px] text-bone-dim">{String(i + 1).padStart(2, "0")}</span>
                            <span className="min-w-0 flex-1 truncate text-[12px] text-bone-dim">{m.proposition}</span>
                            <span className="mono w-10 text-[11px] text-bone">{pick ? "YES" : "NO"}</span>
                            <span className={`mono w-5 text-center text-[13px] ${correct ? "text-confirm" : "text-overturn"}`}>
                              {correct ? "✓" : "✕"}
                            </span>
                            <span className="mono w-12 text-right text-[12px] text-bone-dim">+{pts}</span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* payout footer */}
      <div className="relative border-t border-line bg-panel2/60 px-5 py-4 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="mono text-[11px] text-bone-dim">
            winner-take-all · ties split · dust stays in vault · paid by{" "}
            <span className="text-bone-dim">proofxi::payout</span>
          </span>
          <a
            href={explorer(ROUND.program)}
            target="_blank"
            rel="noreferrer"
            className="kicker text-confirm underline-offset-2 hover:underline"
          >
            VERIFY ON DEVNET ↗
          </a>
        </div>
      </div>
    </div>
  );
}
