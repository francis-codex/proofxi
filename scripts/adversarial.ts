/**
 * ProofXI — adversarial binding test (re-runnable).  The demo's killer moment:
 * "watch me try to rig it → the chain rejects."
 *
 * A settler holds VALID Merkle proof data for a real fixture and tries to cheat.
 * Every attempt must revert on devnet; the honest settle must still pass.
 *
 *   Cheat 1 — tamper the score value (fake a goal) → Merkle leaf no longer chains
 *             to the on-chain root → Txoracle rejects inside the CPI.
 *   Cheat 2 — swap stat keys (feed the away-score proof where the market wants
 *             the home score) → our StatMismatch guard.
 *   Cheat 3 — inject a second stat into a single-stat market (tamper the market's
 *             formula) → our UnexpectedSecondStat guard.
 *   Regression — the honest settle records exactly the proven outcome.
 *
 * There is no `outcome` argument anywhere: the verdict is read from the CPI, and
 * the predicate is rebuilt on-chain from the stored market def. A settler
 * physically cannot prove one thing and record another.
 */

import * as anchor from "@coral-xyz/anchor";
import anchorPkg from "@coral-xyz/anchor";
const { BN } = anchorPkg;
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RPC = "https://api.devnet.solana.com";
const API_ORIGIN = "https://txline-dev.txodds.com";
const TXORACLE = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const PROOFXI = new PublicKey("3wqZbXRsECPBib3sfuHGFtZis9WP9JENm3JHxqBtgNCE");
const DAY_MS = 86_400_000;

const log = (...a: unknown[]) => console.log(...a);
const step = (s: string) => log(`\n\x1b[1m▸ ${s}\x1b[0m`);
const ok = (...a: unknown[]) => log("  \x1b[32m✓\x1b[0m", ...a);
const bad = (...a: unknown[]) => log("  \x1b[31m✗\x1b[0m", ...a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}
function toBytes32(v: string | number[]): number[] {
  const b = Array.isArray(v)
    ? Uint8Array.from(v)
    : v.startsWith("0x")
      ? Buffer.from(v.slice(2), "hex")
      : Buffer.from(v, "base64");
  if (b.length !== 32) throw new Error(`expected 32 bytes got ${b.length}`);
  return Array.from(b);
}
function toProofNodes(nodes: any[] | null) {
  return (nodes ?? []).map((n) => ({ hash: toBytes32(n.hash), isRightSibling: n.isRightSibling }));
}
function errorBlob(e: any): string {
  const parts = [e?.message ?? "", e?.error?.errorCode?.code ?? "", ...(e?.logs ?? [])];
  return parts.join(" | ");
}

async function findScoredFixture(http: any) {
  const todayEpochDay = Math.floor(Date.now() / DAY_MS);
  const windows = [undefined, -28, -20, -12, -6].map((d) => (d == null ? undefined : todayEpochDay + d));
  const byId = new Map<number, any>();
  for (const startEpochDay of windows) {
    try {
      const res = await http.get(`/api/fixtures/snapshot`, {
        params: startEpochDay == null ? {} : { startEpochDay },
      });
      for (const f of res.data ?? []) byId.set(Number(f.FixtureId), f);
    } catch {}
  }
  const now = Date.now();
  const scanOrder = [...byId.values()].sort(
    (a, b) =>
      (Number(a.StartTime) <= now ? 0 : 1) - (Number(b.StartTime) <= now ? 0 : 1) ||
      Number(b.StartTime) - Number(a.StartTime)
  );
  for (const f of scanOrder) {
    const fixtureId = Number(f.FixtureId);
    let snap: any;
    try {
      snap = (await http.get(`/api/scores/snapshot/${fixtureId}?asOf=${Date.now()}`)).data;
    } catch {
      continue;
    }
    const records: any[] = Array.isArray(snap) ? snap : snap ? [snap] : [];
    let best: any = null;
    for (const rec of records) {
      const stats = rec.stats ?? rec.Stats ?? {};
      const seq = rec.seq ?? rec.Seq;
      if (seq != null && "1002" in stats && "1003" in stats) {
        if (!best || Number(seq) > Number(best.seq ?? best.Seq)) best = rec;
      }
    }
    if (best) return { fixture: f, fixtureId, seq: Number(best.seq ?? best.Seq) };
  }
  throw new Error("no fixture with both score stats found");
}

async function main() {
  const session = loadJson<any>(path.join(ROOT, ".txline-session.json"));
  const config = loadJson<any>(path.join(ROOT, ".proofxi-config.json"));
  const idl = loadJson<anchor.Idl>(path.join(ROOT, "target", "idl", "proofxi.json"));
  const usdcMint = new PublicKey(config.usdcMint);
  const main = Keypair.fromSecretKey(
    Uint8Array.from(loadJson<number[]>(path.join(ROOT, "keypairs", "devnet.json")))
  );
  const conn = new Connection(RPC, "confirmed");
  const provider = new anchor.AnchorProvider(conn, new anchor.Wallet(main), { commitment: "confirmed" });
  const proofxi = new anchor.Program(idl, provider);

  const http = axios.create({
    baseURL: API_ORIGIN,
    timeout: 30_000,
    headers: { Authorization: `Bearer ${session.jwt}`, "X-Api-Token": session.apiToken },
  });

  step("Fetch a real, valid proof (home 1002, away 1003)");
  const { fixture, fixtureId, seq } = await findScoredFixture(http);
  const proof = (
    await http.get(`/api/scores/stat-validation`, { params: { fixtureId, seq, statKey: 1002, statKey2: 1003 } })
  ).data;
  const home = proof.statToProve.value;
  const away = proof.statToProve2.value;
  ok(`${fixture.Participant1} ${home} - ${away} ${fixture.Participant2} (fixture ${fixtureId}, seq ${seq})`);

  // Market 0: two-stat "Home win" (1002 - 1003 > 0). Market 1: single "Home to score" (1002 > 0).
  const homeWinTrue = home - away > 0;
  const homeScoreTrue = home > 0;

  // Honest proof args
  const targetTs = new BN(proof.summary.updateStats.minTimestamp);
  const epochDay = Math.floor(Number(proof.summary.updateStats.minTimestamp) / DAY_MS);
  const [dailyPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), new BN(epochDay).toArrayLike(Buffer, "le", 2)],
    TXORACLE
  );
  const summary = {
    fixtureId: new BN(proof.summary.fixtureId),
    updateStats: {
      updateCount: proof.summary.updateStats.updateCount,
      minTimestamp: new BN(proof.summary.updateStats.minTimestamp),
      maxTimestamp: new BN(proof.summary.updateStats.maxTimestamp),
    },
    eventsSubTreeRoot: toBytes32(proof.summary.eventStatsSubTreeRoot),
  };
  const fixtureProof = toProofNodes(proof.subTreeProof);
  const mainTreeProof = toProofNodes(proof.mainTreeProof);
  const statHome = {
    statToProve: proof.statToProve, // key 1002
    eventStatRoot: toBytes32(proof.eventStatRoot),
    statProof: toProofNodes(proof.statProof),
  };
  const statAway = {
    statToProve: proof.statToProve2, // key 1003
    eventStatRoot: toBytes32(proof.eventStatRoot),
    statProof: toProofNodes(proof.statProof2),
  };

  // Fresh round with the two markets, locking almost immediately.
  step("create_round (2 markets, no entrants needed)");
  const roundId = new BN(Date.now());
  const roundIdLe = roundId.toArrayLike(Buffer, "le", 8);
  const [roundPda] = PublicKey.findProgramAddressSync([Buffer.from("round"), roundIdLe], PROOFXI);
  const [vaultAuth] = PublicKey.findProgramAddressSync([Buffer.from("vault_auth"), roundIdLe], PROOFXI);
  const vault = getAssociatedTokenAddressSync(usdcMint, vaultAuth, true);
  const lockTime = Math.floor(Date.now() / 1000) + 6;
  const marketDefs = [
    { fixtureId: new BN(fixtureId), statKeyA: 1002, statKeyB: 1003, useSecond: true, op: 1, comparison: 0, threshold: 0, settled: false, outcome: false },
    { fixtureId: new BN(fixtureId), statKeyA: 1002, statKeyB: 0, useSecond: false, op: 0, comparison: 0, threshold: 0, settled: false, outcome: false },
  ];
  await proofxi.methods
    .createRound(roundId, new BN(0), new BN(lockTime), marketDefs)
    .accounts({
      authority: main.publicKey,
      round: roundPda,
      usdcMint,
      vaultAuthority: vaultAuth,
      vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  ok(`round ${roundPda.toBase58()}`);
  await sleep((lockTime - Math.floor(Date.now() / 1000) + 2) * 1000);
  ok("locked, ready to settle");

  const settle = (idx: number, sA: any, sB: any) =>
    proofxi.methods
      .settleMarket(idx, targetTs, summary, fixtureProof, mainTreeProof, sA, sB)
      .accounts({
        settler: main.publicKey,
        round: roundPda,
        dailyScoresMerkleRoots: dailyPda,
        txoracleProgram: TXORACLE,
      })
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })])
      .rpc();

  let allGood = true;
  async function expectRevert(label: string, fn: () => Promise<any>, mustInclude?: string) {
    try {
      await fn();
      bad(`${label} — DID NOT REVERT (attack succeeded!) ✗`);
      allGood = false;
    } catch (e: any) {
      const blob = errorBlob(e);
      if (mustInclude && !blob.includes(mustInclude)) {
        bad(`${label} — reverted, but not with "${mustInclude}". got: ${blob.slice(0, 160)}`);
        allGood = false;
      } else {
        ok(`${label} — REJECTED${mustInclude ? ` (${mustInclude})` : ""} ✓`);
        if (process.env.VERBOSE) log(`      reason: ${blob.replace(/\s+/g, " ").slice(0, 220)}`);
      }
    }
  }

  step("Cheat 1 — tamper the score value (fake a goal to flip 'Home win')");
  const statHomeTampered = {
    statToProve: { key: 1002, value: home + 5, period: proof.statToProve.period },
    eventStatRoot: toBytes32(proof.eventStatRoot),
    statProof: toProofNodes(proof.statProof),
  };
  await expectRevert("record a home win that never happened", () => settle(0, statHomeTampered, statAway));

  step("Cheat 2 — swap stat keys (feed away-score proof where home is required)");
  await expectRevert("point market at the wrong stat", () => settle(0, statAway, statAway), "StatMismatch");

  step("Cheat 3 — inject a second stat into the single-stat market (tamper the formula)");
  await expectRevert("change the market's formula", () => settle(1, statHome, statAway), "UnexpectedSecondStat");

  step("Regression — honest settle still passes and records the proven outcome");
  try {
    await settle(0, statHome, statAway);
    await settle(1, statHome, null);
    const r: any = await proofxi.account.round.fetch(roundPda);
    const m0 = r.markets[0].settled && r.markets[0].outcome === homeWinTrue;
    const m1 = r.markets[1].settled && r.markets[1].outcome === homeScoreTrue;
    (m0 ? ok : bad)(`M0 Home win settled = ${r.markets[0].outcome} (proven ${homeWinTrue}) ${m0 ? "✓" : "✗"}`);
    (m1 ? ok : bad)(`M1 Home to score settled = ${r.markets[1].outcome} (proven ${homeScoreTrue}) ${m1 ? "✓" : "✗"}`);
    allGood &&= m0 && m1;
  } catch (e: any) {
    bad(`honest settle failed: ${errorBlob(e).slice(0, 200)}`);
    allGood = false;
  }

  step("Verdict");
  if (allGood) {
    ok("Every rig attempt was rejected on-chain; the honest proof settled cleanly.");
    ok("A settler cannot prove one thing and record another. Binding is airtight. 🔒");
  } else {
    bad("adversarial test FAILED — a guarantee did not hold. See above.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\n\x1b[31mfatal:\x1b[0m", e?.message ?? e);
  if (e?.logs) console.error(e.logs.join("\n"));
  process.exit(1);
});
