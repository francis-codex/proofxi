"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { FeedKind, FeedTick } from "@/lib/matchFeed";
import { FIXTURE } from "@/lib/proof";

type Conn = "idle" | "live" | "final";

const KIND_TAG: Record<FeedKind, { t: string; cls: string }> = {
  KICKOFF: { t: "KO", cls: "border-line text-bone" },
  SHOT: { t: "SHOT", cls: "border-line text-bone-dim" },
  ON_TARGET: { t: "SOT", cls: "border-bone/40 text-bone" },
  CORNER: { t: "COR", cls: "border-line text-bone-dim" },
  SAVE: { t: "SAVE", cls: "border-confirm/50 text-confirm" },
  YELLOW: { t: "YEL", cls: "border-[#e8b923]/60 text-[#e8b923]" },
  HALF_TIME: { t: "HT", cls: "border-line text-bone" },
  FULL_TIME: { t: "FT", cls: "border-confirm/60 text-confirm" },
};

export default function LiveMatchCard() {
  const [conn, setConn] = useState<Conn>("idle");
  const [feed, setFeed] = useState<FeedTick[]>([]);
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [minute, setMinute] = useState("0'");
  const esRef = useRef<EventSource | null>(null);

  const stop = () => {
    esRef.current?.close();
    esRef.current = null;
  };

  const goLive = useCallback(() => {
    stop();
    setFeed([]);
    setScore({ home: 0, away: 0 });
    setMinute("0'");
    setConn("live");

    const es = new EventSource("/api/stream");
    esRef.current = es;

    const onTick = (e: MessageEvent) => {
      const t = JSON.parse(e.data) as FeedTick;
      setFeed((f) => [t, ...f]);
      setScore({ home: t.home, away: t.away });
      setMinute(t.minute);
    };

    es.addEventListener("tick", onTick as EventListener);
    es.addEventListener("final", (e) => {
      onTick(e as MessageEvent);
      setConn("final");
      stop();
    });
    es.onerror = () => stop();
  }, []);

  useEffect(() => () => stop(), []);

  return (
    <div className="panel shadow-panel relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 field-grid opacity-50" />

      {/* stream header */}
      <div className="relative flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className={conn === "live" ? "livedot shrink-0" : "block h-[7px] w-[7px] shrink-0 rounded-full bg-bone-mute"} />
          <span className="kicker whitespace-nowrap text-bone">
            {conn === "final" ? "STREAM · FINAL" : conn === "live" ? "STREAM · LIVE" : "STREAM · IDLE"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="micro hidden sm:inline">EVENTS {String(feed.length).padStart(2, "0")}</span>
          <span className="micro whitespace-nowrap text-confirm">TXLINE SCORES · SSE</span>
        </div>
      </div>

      {/* live score bug */}
      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col items-start">
          <span className="display text-[30px] leading-none sm:text-[40px]">{FIXTURE.home.code}</span>
          <span className="mono mt-1 text-[10px] tracking-[0.16em] text-bone-dim">{FIXTURE.home.name.toUpperCase()}</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="display tabular text-[44px] leading-none sm:text-[60px]">
            {score.home}
            <span className="mx-2 text-bone-mute">:</span>
            {score.away}
          </div>
          <div className="mono mt-2 flex items-center gap-2 text-[11px] tracking-[0.18em] text-bone-dim">
            {conn === "live" && <span className="livedot" style={{ width: 5, height: 5 }} />}
            <span className="tabular">{conn === "idle" ? "PRE-MATCH" : minute}</span>
          </div>
        </div>
        <div className="flex flex-col items-end text-right">
          <span className="display text-[30px] leading-none sm:text-[40px]">{FIXTURE.away.code}</span>
          <span className="mono mt-1 text-[10px] tracking-[0.16em] text-bone-dim">{FIXTURE.away.name.toUpperCase()}</span>
        </div>
      </div>

      {/* the ticking feed */}
      <div className="relative border-t border-line">
        <div className="flex items-center justify-between px-5 py-2 sm:px-8">
          <span className="micro">EVENT FEED</span>
          <span className="micro">FIXTURE {FIXTURE.id}</span>
        </div>
        <div className="relative h-[190px] overflow-hidden border-t border-line sm:h-[232px]">
          {conn === "idle" && feed.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <span className="mono text-[12px] text-bone-mute">stream idle — kick off to receive TxLINE events</span>
            </div>
          )}
          <div className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {feed.map((t) => {
                const tag = KIND_TAG[t.kind];
                return (
                  <motion.div
                    key={t.seq}
                    initial={{ opacity: 0, y: -8, backgroundColor: "rgba(36,240,124,0.06)" }}
                    animate={{ opacity: 1, y: 0, backgroundColor: "rgba(36,240,124,0)" }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="flex items-center gap-3 px-5 py-2.5 sm:px-8"
                  >
                    <span className="mono w-12 shrink-0 tabular text-[12px] text-bone">{t.minute}</span>
                    <span className={`mono flex h-5 w-12 shrink-0 items-center justify-center border text-[9px] tracking-[0.1em] ${tag.cls}`}>
                      {tag.t}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-bone-dim">{t.label}</span>
                    <span className="mono hidden shrink-0 text-[10px] text-bone-mute sm:inline">
                      k{t.statKey}={t.statValue}·p{t.period}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-panel to-transparent" />
        </div>
      </div>

      {/* finalize bridge */}
      <AnimatePresence>
        {conn === "final" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="relative overflow-hidden border-t border-line bg-ink"
          >
            <div className="flex flex-col items-start justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-8">
              <div className="min-w-0">
                <div className="kicker text-confirm">STAT SEALED · READY FOR REVIEW</div>
                <div className="mono mt-1.5 text-[11px] text-bone-dim">
                  1002 HOME_GOALS=0 · 1003 AWAY_GOALS=0 · PERIOD FT — Merkle-proven by TxLINE
                </div>
              </div>
              <a
                href="#review"
                className="kicker inline-flex shrink-0 items-center gap-2 border border-confirm bg-confirm px-4 py-2.5 text-ink"
              >
                SEND TO VAR ▸
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* control */}
      <div className="relative flex items-center gap-3 border-t border-line px-5 py-3 sm:px-8">
        <button
          onClick={goLive}
          disabled={conn === "live"}
          className="kicker inline-flex items-center border border-line px-4 py-2 text-bone transition-colors hover:border-line-strong disabled:opacity-40"
        >
          {conn === "idle" ? "KICK OFF ▸" : conn === "live" ? "STREAMING…" : "REPLAY STREAM"}
        </button>
        <span className="mono text-[11px] text-bone-mute">
          {conn === "live" ? "receiving live TxLINE events over SSE" : conn === "final" ? "full time — send the sealed stat to VAR" : "press to open the TxLINE scores stream"}
        </span>
      </div>
    </div>
  );
}
