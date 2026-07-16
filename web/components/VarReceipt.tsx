"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CHAIN,
  FIXTURE,
  MARKET,
  evidenceLayers,
  short,
  type EvidenceLayer,
} from "@/lib/proof";

type Mode = "honest" | "adversarial";
type Phase = "idle" | "engage" | "reveal" | "verdict";
type RowStatus = "idle" | "scanning" | "ok" | "warn" | "reject";

const ENGAGE_MS = 950;
const SCAN_MS = 460;
const SETTLE_MS = 200;

export default function VarReceipt() {
  const [mode, setMode] = useState<Mode>("honest");
  const [phase, setPhase] = useState<Phase>("idle");
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});
  const [verdict, setVerdict] = useState<"confirm" | "overturn" | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const layers = useMemo(() => evidenceLayers(mode), [mode]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const reset = useCallback(() => {
    clearTimers();
    setPhase("idle");
    setStatuses({});
    setVerdict(null);
  }, []);

  useEffect(() => reset(), [mode, reset]);
  useEffect(() => () => clearTimers(), []);

  const run = useCallback(() => {
    clearTimers();
    setStatuses({});
    setVerdict(null);
    setPhase("engage");

    let t = ENGAGE_MS;
    const at = (ms: number, fn: () => void) => {
      timers.current.push(setTimeout(fn, ms));
    };

    at(ENGAGE_MS - 1, () => setPhase("reveal"));

    let halted = false;
    for (const layer of layers) {
      if (halted) break;

      const tamperedLeaf = mode === "adversarial" && layer.id === "leaf";
      const failHere = mode === "adversarial" && layer.id === "root";

      const scanAt = t;
      at(scanAt, () =>
        setStatuses((s) => ({ ...s, [layer.id]: "scanning" }))
      );

      const resolveAt = t + SCAN_MS;
      if (failHere) {
        at(resolveAt, () =>
          setStatuses((s) => ({ ...s, [layer.id]: "reject" }))
        );
        at(resolveAt + 520, () => {
          setPhase("verdict");
          setVerdict("overturn");
        });
        halted = true;
      } else if (tamperedLeaf) {
        at(resolveAt, () => setStatuses((s) => ({ ...s, [layer.id]: "warn" })));
      } else {
        at(resolveAt, () => setStatuses((s) => ({ ...s, [layer.id]: "ok" })));
      }
      t = resolveAt + SETTLE_MS;
    }

    if (mode === "honest") {
      at(t + 380, () => {
        setPhase("verdict");
        setVerdict("confirm");
      });
    }
  }, [layers, mode]);

  const engaged = phase !== "idle";

  return (
    <div className="w-full">
      {/* ---- broadcast frame ---- */}
      <div className="panel shadow-panel relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 field-grid opacity-60" />

        {/* status strip */}
        <div className="relative flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="livedot shrink-0" />
            <span className="kicker whitespace-nowrap text-bone">
              LIVE · <span className="sm:hidden">WORLD CUP</span>
              <span className="hidden sm:inline">{FIXTURE.competition}</span>
            </span>
            <span className="micro hidden sm:inline">{FIXTURE.stage}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="micro hidden sm:inline">FIXTURE {FIXTURE.id}</span>
            <span className="micro whitespace-nowrap text-confirm">POWERED BY TXLINE</span>
          </div>
        </div>

        {/* score bug */}
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-6 sm:px-8 sm:py-8">
          <Team code={FIXTURE.home.code} name={FIXTURE.home.name} align="left" />
          <div className="flex flex-col items-center">
            <div className="display tabular text-[54px] leading-none sm:text-[76px]">
              {FIXTURE.homeGoals}
              <span className="mx-2 text-bone-mute sm:mx-3">:</span>
              {FIXTURE.awayGoals}
            </div>
            <div className="mono mt-2 text-[11px] tracking-[0.2em] text-bone-dim">
              FT · 90&apos;+4
            </div>
          </div>
          <Team code={FIXTURE.away.code} name={FIXTURE.away.name} align="right" />
        </div>

        {/* proposition lower-third */}
        <div className="relative border-t border-line bg-panel2/60 px-5 py-3 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-baseline gap-3">
              <span className="micro">REVIEWING</span>
              <span className="display text-[19px] sm:text-[22px]">
                {MARKET.proposition}
              </span>
            </div>
            <span className="mono text-[11px] text-bone-dim">{MARKET.formula}</span>
          </div>
        </div>

        {/* ---- the review ---- */}
        <AnimatePresence>
          {engaged && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
              className="relative overflow-hidden border-t border-line"
            >
              {/* going-to-VAR header with hazard geometry */}
              <div className="relative flex items-center gap-3 overflow-hidden bg-ink px-5 py-2.5 sm:px-8">
                <div
                  className={`absolute inset-y-0 right-0 w-40 opacity-25 ${
                    verdict === "overturn" ? "hazard-red" : "hazard"
                  }`}
                />
                <motion.span
                  animate={{ opacity: [1, 0.35, 1] }}
                  transition={{ duration: 1.4, repeat: phase === "verdict" ? 0 : Infinity }}
                  className={`kicker ${
                    verdict === "overturn" ? "text-overturn" : "text-confirm"
                  }`}
                >
                  ▸ GOING TO VAR
                </motion.span>
                <span className="micro relative">ON-CHAIN REVIEW · validate_stat CPI</span>
              </div>

              {/* evidence stack */}
              <div className="relative divide-y divide-line">
                {layers.map((layer, i) => (
                  <EvidenceRow
                    key={layer.id}
                    layer={layer}
                    status={statuses[layer.id] ?? "idle"}
                    index={i}
                  />
                ))}
              </div>

              {/* verdict */}
              <AnimatePresence>
                {verdict && (
                  <Verdict verdict={verdict} />
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---- controls ---- */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={run}
          disabled={phase === "engage" || phase === "reveal"}
          className="group relative inline-flex items-center justify-center gap-2 border border-confirm bg-confirm px-5 py-3 text-ink transition-opacity disabled:opacity-40 max-sm:w-full sm:py-2.5"
        >
          <span className="kicker text-ink">
            {phase === "idle" ? "RUN VAR REVIEW" : phase === "verdict" ? "REVIEW AGAIN" : "REVIEWING…"}
          </span>
        </button>

        <ModeToggle mode={mode} setMode={setMode} disabled={phase === "engage" || phase === "reveal"} />

        {phase === "idle" && (
          <span className="mono text-[11px] text-bone-mute">
            press to send the stat to VAR
          </span>
        )}
      </div>

      {/* provenance footer */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
        <Prov k="program" v={short(CHAIN.proofxi, 4, 4)} />
        <Prov k="txoracle" v={short(CHAIN.txoracle, 4, 4)} />
        <Prov k="cluster" v={CHAIN.cluster} />
      </div>
    </div>
  );
}

function Team({
  code,
  name,
  align,
}: {
  code: string;
  name: string;
  align: "left" | "right";
}) {
  return (
    <div className={`flex flex-col ${align === "right" ? "items-end text-right" : "items-start"}`}>
      <span className="display text-[34px] leading-none sm:text-[46px]">{code}</span>
      <span className="mono mt-1.5 text-[10px] tracking-[0.18em] text-bone-dim">
        {name.toUpperCase()}
      </span>
    </div>
  );
}

function EvidenceRow({
  layer,
  status,
  index,
}: {
  layer: EvidenceLayer;
  status: RowStatus;
  index: number;
}) {
  const revealed = status !== "idle";
  return (
    <motion.div
      initial={false}
      animate={{ opacity: revealed ? 1 : 0.32 }}
      transition={{ duration: 0.2 }}
      className="relative flex items-center gap-4 px-5 py-3 sm:px-8"
    >
      {/* scanning sweep — a quiet motion, only during scan */}
      {status === "scanning" && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-confirm/70 sweep" />
      )}

      <span className="mono w-[46px] shrink-0 text-[10px] tracking-[0.14em] text-bone-dim">
        {String(index).padStart(2, "0")}
      </span>

      <span
        className={`mono flex h-6 w-14 shrink-0 items-center justify-center border text-[10px] tracking-[0.12em] ${
          status === "reject"
            ? "border-overturn text-overturn"
            : status === "warn"
            ? "border-[#e8b923] text-[#e8b923]"
            : status === "ok"
            ? "border-confirm/60 text-confirm"
            : "border-line text-bone-dim"
        }`}
      >
        {layer.tag}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-bone">{layer.label}</span>
        </div>
        <div className="mono truncate text-[11px] text-bone-mute">{layer.detail}</div>
      </div>

      {layer.hash && (
        <span className="mono hidden shrink-0 text-[11px] text-bone-dim sm:inline">
          {layer.hash}
        </span>
      )}

      <StatusGlyph status={status} />
    </motion.div>
  );
}

function StatusGlyph({ status }: { status: RowStatus }) {
  return (
    <span className="flex w-5 shrink-0 justify-center">
      {status === "ok" && (
        <motion.svg
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 24 }}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="M3 8.5l3.2 3.2L13 5" stroke="var(--confirm)" strokeWidth="2" />
        </motion.svg>
      )}
      {status === "reject" && (
        <motion.svg
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="M4 4l8 8M12 4l-8 8" stroke="var(--overturn)" strokeWidth="2" />
        </motion.svg>
      )}
      {status === "warn" && (
        <span className="mono text-[13px] text-[#e8b923]">!</span>
      )}
      {status === "scanning" && (
        <motion.span
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 0.9, repeat: Infinity }}
          className="block h-1.5 w-1.5 rounded-full bg-confirm"
        />
      )}
    </span>
  );
}

function Verdict({ verdict }: { verdict: "confirm" | "overturn" }) {
  const isConfirm = verdict === "confirm";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative overflow-hidden border-t border-line bg-ink px-5 py-6 sm:px-8"
    >
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          {/* the one loud gesture: the stamp */}
          <motion.div
            initial={{ scale: 1.6, opacity: 0, rotate: -9 }}
            animate={{ scale: 1, opacity: 1, rotate: -6 }}
            transition={{ type: "spring", stiffness: 260, damping: 15 }}
            className={`display border-[3px] px-4 py-1.5 text-[38px] sm:text-[52px] ${
              isConfirm ? "stamp-confirm" : "stamp-overturn"
            }`}
          >
            {isConfirm ? "CONFIRMED" : "OVERTURNED"}
          </motion.div>
        </div>

        <div className="max-w-sm sm:text-right">
          <div className="mono text-[11px] leading-relaxed text-bone-dim">
            {isConfirm ? (
              <>
                predicate satisfied on-chain · funds released to winners ·
                settlement is final and cannot be contested
              </>
            ) : (
              <>
                recomputed root ≠ TxLINE signed root · validate_stat aborts
                (InvalidStatProof) · escrow stays locked · the cheat is rejected
                by the chain
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ModeToggle({
  mode,
  setMode,
  disabled,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex border border-line max-sm:w-full">
      {(["honest", "adversarial"] as Mode[]).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            disabled={disabled}
            onClick={() => setMode(m)}
            className={`kicker px-3.5 py-3 transition-colors disabled:opacity-40 max-sm:flex-1 sm:py-2.5 ${
              active
                ? m === "adversarial"
                  ? "bg-overturn text-ink"
                  : "bg-bone text-ink"
                : "text-bone-dim hover:text-bone"
            }`}
          >
            {m === "honest" ? "HONEST" : "TRY TO RIG IT"}
          </button>
        );
      })}
    </div>
  );
}

function Prov({ k, v }: { k: string; v: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="micro">{k}</span>
      <span className="mono text-[11px] text-bone-dim">{v}</span>
    </span>
  );
}
