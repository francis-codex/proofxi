"use client";

import { useEffect, useState } from "react";
import { readDevnet, type DevnetSnapshot } from "@/lib/chain";
import { CHAIN } from "@/lib/proof";

export default function DevnetStatus() {
  const [snap, setSnap] = useState<DevnetSnapshot | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    readDevnet(CHAIN.proofxi, CHAIN.usdcMint)
      .then((s) => alive && setSnap(s))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, []);

  const ok = snap && snap.programExecutable;

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={
          err
            ? "block h-[7px] w-[7px] shrink-0 rounded-full bg-overturn"
            : ok
            ? "livedot shrink-0"
            : "block h-[7px] w-[7px] shrink-0 animate-pulse rounded-full bg-bone-mute"
        }
      />
      <span className="micro whitespace-nowrap">
        {err
          ? "DEVNET · UNREACHABLE"
          : snap
          ? `DEVNET · SLOT ${snap.slot.toLocaleString()}`
          : "DEVNET · CONNECTING"}
      </span>
    </div>
  );
}
