/**
 * The demo round — mirrors the exact round proven on-chain by scripts/verify-proof.ts
 * (France 4–0 England, fixture 18257865). Three boolean markets, each an
 * OUTCOME proven via validate_stat; odds-weights are stored game params
 * committed at `enter` (not proven, per the v1 scope guard). All three markets
 * resolve YES on a 4–0, so the player who picked YES across the board wins the pot.
 */

import { CHAIN } from "@/lib/proof";

export type Market = {
  id: string;
  proposition: string;
  formula: string;
  outcome: boolean; // proven result (true = YES hit)
  proofHash: string; // event-stat root the outcome was proven against
};

// event-stat root from the real proof (proof-sample.json → eventStatRoot)
const ROOT = "0x8b6eeabfe1a400bf458e85cf1feb23bb23987f7982bcb6a2b60b2f7e8eacd33f";

export const MARKETS: Market[] = [
  {
    id: "m1",
    proposition: "FRANCE TO WIN",
    formula: "STAT[1002] − STAT[1003] > 0",
    outcome: true,
    proofHash: ROOT,
  },
  {
    id: "m2",
    proposition: "A GOAL IN THE MATCH",
    formula: "STAT[1002] + STAT[1003] > 0",
    outcome: true,
    proofHash: ROOT,
  },
  {
    id: "m3",
    proposition: "FRANCE TO SCORE",
    formula: "STAT[1002] > 0",
    outcome: true,
    proofHash: ROOT,
  },
];

export const ROUND = {
  id: 1,
  entryFee: 10, // test-USDC (6 decimals)
  players: 2,
  pot: 20,
  lockLabel: "KICK-OFF",
  usdcMint: CHAIN.usdcMint,
  program: CHAIN.proofxi,
} as const;

export type PlayerSlate = {
  handle: string;
  picks: boolean[]; // per market, in MARKETS order
  weights: number[]; // odds-weights committed at enter
  captain: number; // index, scores 2×
};

export const PLAYERS: PlayerSlate[] = [
  { handle: "player_a", picks: [true, true, true], weights: [30, 20, 25], captain: 0 },
  { handle: "player_b", picks: [false, false, false], weights: [30, 20, 25], captain: 0 },
];

// scoring: correct pick = its weight; captain 2×. Highest total takes the pot.
export function scoreSlate(slate: PlayerSlate): number {
  return MARKETS.reduce((sum, m, i) => {
    const correct = slate.picks[i] === m.outcome;
    if (!correct) return sum;
    const w = slate.weights[i] * (i === slate.captain ? 2 : 1);
    return sum + w;
  }, 0);
}

export function standings() {
  const rows = PLAYERS.map((p) => ({ ...p, score: scoreSlate(p) }));
  rows.sort((a, b) => b.score - a.score);
  const best = rows[0]?.score ?? 0;
  const winners = rows.filter((r) => r.score === best).length;
  return rows.map((r, i) => ({
    ...r,
    rank: i + 1,
    isWinner: r.score === best,
    payout: r.score === best ? ROUND.pot / winners : 0,
  }));
}
