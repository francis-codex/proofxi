/**
 * Replayed TxLINE scores-stream for fixture 18188721 (Paraguay 0–0 France).
 * Each tick mirrors the shape TxLINE pushes on its live scores SSE — a stat
 * update carrying { key, value, period } plus match context. The sequence
 * ends on the exact final the on-chain proof attests: 1002=0, 1003=0, period FT.
 * Replayed feeds are explicitly allowed for the demo; the transport (see
 * app/api/stream/route.ts) is a genuine Server-Sent-Events stream.
 */

export type FeedKind =
  | "KICKOFF"
  | "SHOT"
  | "ON_TARGET"
  | "CORNER"
  | "SAVE"
  | "YELLOW"
  | "HALF_TIME"
  | "FULL_TIME";

export type FeedTick = {
  seq: number;
  minute: string;
  period: number; // 1 = 1st half, 2 = 2nd half, 4 = full time (TxLINE period)
  kind: FeedKind;
  team?: "PAR" | "FRA";
  home: number;
  away: number;
  // canonical proven stats (TxLINE keys): 1002 home goals, 1003 away goals
  statKey: number;
  statValue: number;
  label: string;
  final?: boolean;
};

const K_HOME = 1002;
const K_AWAY = 1003;

export const FEED: FeedTick[] = [
  { seq: 1, minute: "0'", period: 1, kind: "KICKOFF", home: 0, away: 0, statKey: K_HOME, statValue: 0, label: "KICK-OFF · FIRST HALF" },
  { seq: 2, minute: "6'", period: 1, kind: "SHOT", team: "FRA", home: 0, away: 0, statKey: 1401, statValue: 1, label: "SHOT · FRANCE" },
  { seq: 3, minute: "12'", period: 1, kind: "CORNER", team: "PAR", home: 0, away: 0, statKey: 1301, statValue: 1, label: "CORNER · PARAGUAY" },
  { seq: 4, minute: "19'", period: 1, kind: "ON_TARGET", team: "FRA", home: 0, away: 0, statKey: 1402, statValue: 1, label: "ON TARGET · FRANCE" },
  { seq: 5, minute: "20'", period: 1, kind: "SAVE", team: "PAR", home: 0, away: 0, statKey: 1501, statValue: 1, label: "SAVE · PARAGUAY GK" },
  { seq: 6, minute: "27'", period: 1, kind: "YELLOW", team: "PAR", home: 0, away: 0, statKey: 1601, statValue: 1, label: "YELLOW CARD · PARAGUAY" },
  { seq: 7, minute: "34'", period: 1, kind: "SHOT", team: "PAR", home: 0, away: 0, statKey: 1401, statValue: 2, label: "SHOT · PARAGUAY" },
  { seq: 8, minute: "45'", period: 1, kind: "HALF_TIME", home: 0, away: 0, statKey: K_HOME, statValue: 0, label: "HALF TIME · 0–0" },
  { seq: 9, minute: "52'", period: 2, kind: "ON_TARGET", team: "PAR", home: 0, away: 0, statKey: 1402, statValue: 2, label: "ON TARGET · PARAGUAY" },
  { seq: 10, minute: "53'", period: 2, kind: "SAVE", team: "FRA", home: 0, away: 0, statKey: 1501, statValue: 2, label: "SAVE · FRANCE GK" },
  { seq: 11, minute: "61'", period: 2, kind: "CORNER", team: "FRA", home: 0, away: 0, statKey: 1301, statValue: 2, label: "CORNER · FRANCE" },
  { seq: 12, minute: "68'", period: 2, kind: "SHOT", team: "FRA", home: 0, away: 0, statKey: 1401, statValue: 3, label: "SHOT · FRANCE" },
  { seq: 13, minute: "74'", period: 2, kind: "YELLOW", team: "FRA", home: 0, away: 0, statKey: 1601, statValue: 2, label: "YELLOW CARD · FRANCE" },
  { seq: 14, minute: "81'", period: 2, kind: "ON_TARGET", team: "FRA", home: 0, away: 0, statKey: 1402, statValue: 3, label: "ON TARGET · FRANCE" },
  { seq: 15, minute: "88'", period: 2, kind: "CORNER", team: "PAR", home: 0, away: 0, statKey: 1301, statValue: 3, label: "CORNER · PARAGUAY" },
  { seq: 16, minute: "90'+4", period: 4, kind: "FULL_TIME", home: 0, away: 0, statKey: K_HOME, statValue: 0, label: "FULL TIME · STAT SEALED", final: true },
];

export const TICK_MS = 420;
