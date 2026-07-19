/**
 * Replayed TxLINE scores-stream for fixture 18257865 (France 4–0 England).
 * Each tick mirrors the shape TxLINE pushes on its live scores SSE — a stat
 * update carrying { key, value, period } plus match context. The sequence
 * ends on the exact final the on-chain proof attests: 1002=4, 1003=0, period FT.
 * Replayed feeds are explicitly allowed for the demo; the transport (see
 * app/api/stream/route.ts) is a genuine Server-Sent-Events stream.
 */

export type FeedKind =
  | "KICKOFF"
  | "SHOT"
  | "ON_TARGET"
  | "GOAL"
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
  team?: "FRA" | "ENG";
  home: number;
  away: number;
  // canonical proven stats (TxLINE keys): 1002 home goals, 1003 away goals
  statKey: number;
  statValue: number;
  label: string;
  final?: boolean;
};

const K_HOME = 1002;

export const FEED: FeedTick[] = [
  { seq: 1, minute: "0'", period: 1, kind: "KICKOFF", home: 0, away: 0, statKey: K_HOME, statValue: 0, label: "KICK-OFF · FIRST HALF" },
  { seq: 2, minute: "7'", period: 1, kind: "SHOT", team: "FRA", home: 0, away: 0, statKey: 1401, statValue: 1, label: "SHOT · FRANCE" },
  { seq: 3, minute: "14'", period: 1, kind: "GOAL", team: "FRA", home: 1, away: 0, statKey: K_HOME, statValue: 1, label: "GOAL · FRANCE — 1–0" },
  { seq: 4, minute: "23'", period: 1, kind: "ON_TARGET", team: "ENG", home: 1, away: 0, statKey: 1402, statValue: 1, label: "ON TARGET · ENGLAND" },
  { seq: 5, minute: "31'", period: 1, kind: "SAVE", team: "FRA", home: 1, away: 0, statKey: 1501, statValue: 1, label: "SAVE · FRANCE GK" },
  { seq: 6, minute: "39'", period: 1, kind: "GOAL", team: "FRA", home: 2, away: 0, statKey: K_HOME, statValue: 2, label: "GOAL · FRANCE — 2–0" },
  { seq: 7, minute: "45'", period: 1, kind: "HALF_TIME", home: 2, away: 0, statKey: K_HOME, statValue: 2, label: "HALF TIME · 2–0" },
  { seq: 8, minute: "54'", period: 2, kind: "CORNER", team: "ENG", home: 2, away: 0, statKey: 1301, statValue: 1, label: "CORNER · ENGLAND" },
  { seq: 9, minute: "58'", period: 2, kind: "GOAL", team: "FRA", home: 3, away: 0, statKey: K_HOME, statValue: 3, label: "GOAL · FRANCE — 3–0" },
  { seq: 10, minute: "63'", period: 2, kind: "YELLOW", team: "ENG", home: 3, away: 0, statKey: 1601, statValue: 1, label: "YELLOW CARD · ENGLAND" },
  { seq: 11, minute: "70'", period: 2, kind: "SHOT", team: "ENG", home: 3, away: 0, statKey: 1401, statValue: 2, label: "SHOT · ENGLAND" },
  { seq: 12, minute: "77'", period: 2, kind: "GOAL", team: "FRA", home: 4, away: 0, statKey: K_HOME, statValue: 4, label: "GOAL · FRANCE — 4–0" },
  { seq: 13, minute: "84'", period: 2, kind: "SAVE", team: "FRA", home: 4, away: 0, statKey: 1501, statValue: 2, label: "SAVE · FRANCE GK" },
  { seq: 14, minute: "90'+3", period: 4, kind: "FULL_TIME", home: 4, away: 0, statKey: K_HOME, statValue: 4, label: "FULL TIME · STAT SEALED", final: true },
];

export const TICK_MS = 420;
