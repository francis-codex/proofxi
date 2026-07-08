/**
 * Shapes the REAL TxLINE proof (web/data/proof-sample.json, fixture 18188721,
 * Paraguay 0–0 France) into the evidence layers the VAR receipt reveals.
 * Nothing here is invented — every hash is the hex of the actual proof bytes
 * pulled from the deployed Txoracle snapshot. The adversarial path tampers a
 * single leaf byte, which breaks the Merkle path exactly as the on-chain
 * check does (see scripts/adversarial.ts cheat #1 → InvalidStatProof).
 */

import raw from "@/data/proof-sample.json";

// ---- on-chain facts (deployed devnet) ----
export const CHAIN = {
  proofxi: "3wqZbXRsECPBib3sfuHGFtZis9WP9JENm3JHxqBtgNCE",
  proofVerifier: "FLfi8rshUqV8cn71Z1nj29bFLmDdAhiHsVBoqLvhia1F",
  txoracle: "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
  usdcMint: "85s4zWGJ5FLSG1RtqiekE5QQBcNwSvtBgmbEy7UwmwDD",
  cluster: "devnet",
} as const;

export const FIXTURE = {
  id: raw.summary.fixtureId,
  home: { code: "PAR", name: "Paraguay" },
  away: { code: "FRA", name: "France" },
  homeGoals: raw.statToProve.value, // key 1002
  awayGoals: raw.statToProve2.value, // key 1003
  competition: "FIFA WORLD CUP",
  stage: "GROUP STAGE · MD2",
} as const;

function toHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function short(hex: string, head = 6, tail = 6): string {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return `0x${h.slice(0, head)}…${h.slice(-tail)}`;
}

const eventStatRootHex = toHex(raw.eventStatRoot);
const subTreeRootHex = toHex(raw.summary.eventStatsSubTreeRoot);
const leafHex = toHex(raw.statProof[0].hash);

// tamper one byte of the leaf for the adversarial run — this is the exact
// class of cheat the chain rejects: the path no longer hashes to the root.
const tamperedLeaf = [...raw.statProof[0].hash];
tamperedLeaf[0] = (tamperedLeaf[0] + 1) & 0xff;
const tamperedLeafHex = toHex(tamperedLeaf);

export type LayerStatus = "idle" | "scanning" | "ok" | "reject";

export type EvidenceLayer = {
  id: string;
  tag: string;
  label: string;
  detail: string;
  hash?: string;
  fullHash?: string;
};

export const MARKET = {
  proposition: "SCORES LEVEL AT REVIEW",
  formula: "STAT[1002] − STAT[1003] == 0",
  statKeyA: 1002,
  statKeyB: 1003,
  comparison: "EQUAL_TO",
  threshold: 0,
} as const;

export function evidenceLayers(mode: "honest" | "adversarial"): EvidenceLayer[] {
  const leaf = mode === "adversarial" ? tamperedLeafHex : leafHex;
  return [
    {
      id: "stat",
      tag: "STAT",
      label: "Finalized stat pair",
      detail: `1002 HOME_GOALS=${FIXTURE.homeGoals} · 1003 AWAY_GOALS=${FIXTURE.awayGoals} · PERIOD FT`,
    },
    {
      id: "leaf",
      tag: "LEAF",
      label: mode === "adversarial" ? "Merkle leaf · TAMPERED" : "Merkle leaf",
      detail:
        mode === "adversarial"
          ? "byte[0] altered by settler"
          : "keccak leaf of the stat record",
      hash: short(leaf),
      fullHash: `0x${leaf}`,
    },
    {
      id: "path",
      tag: "PATH",
      label: "Inclusion proof",
      detail: `${raw.statProof.length} siblings → event-stat sub-tree`,
      hash: short(toHex(raw.statProof[1].hash)),
      fullHash: `0x${toHex(raw.statProof[1].hash)}`,
    },
    {
      id: "root",
      tag: "ROOT",
      label: "Event-stat root",
      detail: "recomputed root must equal signed root",
      hash: short(eventStatRootHex),
      fullHash: `0x${eventStatRootHex}`,
    },
    {
      id: "summary",
      tag: "SUMM",
      label: "Fixture summary",
      detail: `fixture ${FIXTURE.id} · ${raw.summary.updateStats.updateCount} updates`,
      hash: short(subTreeRootHex),
      fullHash: `0x${subTreeRootHex}`,
    },
    {
      id: "sign",
      tag: "SIGN",
      label: "TxLINE signed snapshot",
      detail: `attested @ ${new Date(raw.ts).toISOString().replace("T", " ").slice(0, 19)}Z`,
      hash: short(eventStatRootHex, 4, 8),
      fullHash: `0x${eventStatRootHex}`,
    },
    {
      id: "cpi",
      tag: "CPI",
      label: "validate_stat · on-chain review",
      detail: "predicate rebuilt on-chain · get_return_data → bool",
      hash: short(CHAIN.txoracle, 4, 6),
      fullHash: CHAIN.txoracle,
    },
  ];
}

// the honest run resolves TRUE against the real 0–0 data (home==away),
// the adversarial run never reaches a verdict — the chain rejects the leaf.
export const RAW_TS = raw.ts;
