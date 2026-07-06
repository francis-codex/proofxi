/**
 * ProofXI — Phase 3: full simulated round, end to end on devnet.  (Jul 11 kill-switch)
 *
 *   create_round → two players faucet test-USDC + enter (commit slates) →
 *   settle every market via the trustless validate_stat CPI → deterministic
 *   score → payout the winner → assert every USDC balance.
 *
 * Player A commits the TRUE outcomes (read from the real proof), Player B the
 * negation. A must win the whole pot. All settlement is proven against real
 * on-chain Txoracle Merkle roots — no admin verdicts anywhere.
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
  LAMPORTS_PER_SOL,
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
const USDC = 1_000_000; // 6 decimals

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
  return (nodes ?? []).map((n) => ({
    hash: toBytes32(n.hash),
    isRightSibling: n.isRightSibling,
  }));
}

function programFor(kp: Keypair, idl: anchor.Idl): anchor.Program {
  const connection = new Connection(RPC, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(kp), {
    commitment: "confirmed",
  });
  return new anchor.Program(idl, provider);
}

async function usdcBalance(conn: Connection, ata: PublicKey): Promise<number> {
  try {
    const b = await conn.getTokenAccountBalance(ata);
    return Number(b.value.amount) / USDC;
  } catch {
    return 0;
  }
}

/** Find a played fixture with both home (1002) and away (1003) score stats. */
async function findScoredFixture(http: any) {
  const todayEpochDay = Math.floor(Date.now() / DAY_MS);
  const windows = [undefined, -28, -20, -12, -6].map((d) =>
    d == null ? undefined : todayEpochDay + d
  );
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
  const [usdcMintAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("usdc_mint_authority")],
    PROOFXI
  );

  const main = Keypair.fromSecretKey(
    Uint8Array.from(loadJson<number[]>(path.join(ROOT, "keypairs", "devnet.json")))
  );
  const conn = new Connection(RPC, "confirmed");
  const proofxi = programFor(main, idl);

  const http = axios.create({
    baseURL: API_ORIGIN,
    timeout: 30_000,
    headers: {
      Authorization: `Bearer ${session.jwt}`,
      "X-Api-Token": session.apiToken,
    },
  });

  // --- Real proof for a played fixture --------------------------------------
  step("Fetch a real proof (two-stat: home 1002, away 1003)");
  const { fixture, fixtureId, seq } = await findScoredFixture(http);
  const proof = (
    await http.get(`/api/scores/stat-validation`, {
      params: { fixtureId, seq, statKey: 1002, statKey2: 1003 },
    })
  ).data;
  const home = proof.statToProve.value;
  const away = proof.statToProve2.value;
  ok(`${fixture.Participant1} ${home} - ${away} ${fixture.Participant2} (fixture ${fixtureId}, seq ${seq})`);

  // --- Markets + true outcomes (deterministic from the proof values) --------
  // cmp: 0=GT 1=LT 2=EQ ; op: 0=Add 1=Subtract
  const markets = [
    { name: "Home win", fixtureId, statKeyA: 1002, statKeyB: 1003, useSecond: true, op: 1, comparison: 0, threshold: 0, oddsWeight: 30 },
    { name: "Any goals (O0.5)", fixtureId, statKeyA: 1002, statKeyB: 1003, useSecond: true, op: 0, comparison: 0, threshold: 0, oddsWeight: 20 },
    { name: "Home to score", fixtureId, statKeyA: 1002, statKeyB: 0, useSecond: false, op: 0, comparison: 0, threshold: 0, oddsWeight: 25 },
  ];
  const trueOutcomes = [home - away > 0, home + away > 0, home > 0];
  markets.forEach((m, i) => log(`   M${i} ${m.name}: true outcome = ${trueOutcomes[i]} (weight ${m.oddsWeight})`));

  const captainIndex = 0;
  const entryFee = 10 * USDC;
  const roundId = new BN(Date.now());
  const roundIdLe = roundId.toArrayLike(Buffer, "le", 8);
  const [roundPda] = PublicKey.findProgramAddressSync([Buffer.from("round"), roundIdLe], PROOFXI);
  const [vaultAuth] = PublicKey.findProgramAddressSync([Buffer.from("vault_auth"), roundIdLe], PROOFXI);
  const vault = getAssociatedTokenAddressSync(usdcMint, vaultAuth, true);

  // --- create_round ----------------------------------------------------------
  step("create_round");
  const lockTime = Math.floor(Date.now() / 1000) + 35;
  const marketDefs = markets.map((m) => ({
    fixtureId: new BN(m.fixtureId),
    statKeyA: m.statKeyA,
    statKeyB: m.statKeyB,
    useSecond: m.useSecond,
    op: m.op,
    comparison: m.comparison,
    threshold: m.threshold,
    settled: false,
    outcome: false,
  }));
  await proofxi.methods
    .createRound(roundId, new BN(entryFee), new BN(lockTime), marketDefs)
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
  ok(`round ${roundPda.toBase58()} (entry ${entryFee / USDC} USDC, locks in 35s)`);

  // --- Players: fund SOL, faucet USDC, enter ---------------------------------
  const players: { name: string; kp: Keypair; picks: boolean[] }[] = [
    { name: "Player A", kp: Keypair.generate(), picks: trueOutcomes },
    { name: "Player B", kp: Keypair.generate(), picks: trueOutcomes.map((o) => !o) },
  ];

  step("Fund players with SOL (system transfer, no faucet needed)");
  {
    const { Transaction } = await import("@solana/web3.js");
    const tx = new Transaction();
    for (const p of players) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: main.publicKey,
          toPubkey: p.kp.publicKey,
          lamports: 0.1 * LAMPORTS_PER_SOL,
        })
      );
    }
    await anchor.web3.sendAndConfirmTransaction(conn, tx, [main]);
    for (const p of players) ok(`${p.name} ${p.kp.publicKey.toBase58()} funded 0.1 SOL`);
  }

  step("Players faucet test-USDC (100 each) + enter with their slate");
  for (const p of players) {
    const prog = programFor(p.kp, idl);
    const ata = getAssociatedTokenAddressSync(usdcMint, p.kp.publicKey);
    await prog.methods
      .faucet(new BN(100 * USDC))
      .accounts({
        payer: p.kp.publicKey,
        mint: usdcMint,
        mintAuthority: usdcMintAuthority,
        recipientAta: ata,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const [entryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("entry"), roundPda.toBuffer(), p.kp.publicKey.toBuffer()],
      PROOFXI
    );
    const picks = p.picks.map((prediction, i) => ({
      prediction,
      oddsWeight: markets[i].oddsWeight,
    }));
    await prog.methods
      .enter(picks, captainIndex)
      .accounts({
        player: p.kp.publicKey,
        round: roundPda,
        entry: entryPda,
        playerAta: ata,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    ok(`${p.name} faucet 100 + entered. picks=[${p.picks.join(", ")}] captain=M${captainIndex}`);
  }

  // --- wait for lock ---------------------------------------------------------
  const waitMs = (lockTime - Math.floor(Date.now() / 1000) + 3) * 1000;
  step(`Waiting ${Math.ceil(waitMs / 1000)}s for round to lock`);
  await sleep(Math.max(waitMs, 0));
  ok("locked");

  // --- settle every market via the trustless CPI -----------------------------
  step("settle_market (validate_stat CPI, predicate built on-chain)");
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
  const statA = {
    statToProve: proof.statToProve,
    eventStatRoot: toBytes32(proof.eventStatRoot),
    statProof: toProofNodes(proof.statProof),
  };
  const statB = {
    statToProve: proof.statToProve2,
    eventStatRoot: toBytes32(proof.eventStatRoot),
    statProof: toProofNodes(proof.statProof2),
  };

  for (let i = 0; i < markets.length; i++) {
    const secondStat = markets[i].useSecond ? statB : null;
    await proofxi.methods
      .settleMarket(i, targetTs, summary, fixtureProof, mainTreeProof, statA, secondStat)
      .accounts({
        settler: main.publicKey,
        round: roundPda,
        dailyScoresMerkleRoots: dailyPda,
        txoracleProgram: TXORACLE,
      })
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })])
      .rpc();
    const r: any = await proofxi.account.round.fetch(roundPda);
    const outcome = r.markets[i].outcome;
    const matches = outcome === trueOutcomes[i];
    (matches ? ok : bad)(`M${i} ${markets[i].name} → proven ${outcome} (expected ${trueOutcomes[i]}) ${matches ? "✓" : "✗"}`);
  }

  // --- score -----------------------------------------------------------------
  step("score (deterministic: correct pick = odds-weight, captain 2x)");
  for (const p of players) {
    const [entryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("entry"), roundPda.toBuffer(), p.kp.publicKey.toBuffer()],
      PROOFXI
    );
    await proofxi.methods.score().accounts({ scorer: main.publicKey, round: roundPda, entry: entryPda }).rpc();
    const e: any = await proofxi.account.entry.fetch(entryPda);
    ok(`${p.name} score = ${e.score.toString()}`);
  }
  const roundState: any = await proofxi.account.round.fetch(roundPda);
  ok(`best_score=${roundState.bestScore.toString()} winner_count=${roundState.winnerCount} pot=${Number(roundState.pot) / USDC} USDC`);

  // --- payout ----------------------------------------------------------------
  step("payout (winner-take-all, ties split)");
  const winners = [];
  for (const p of players) {
    const [entryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("entry"), roundPda.toBuffer(), p.kp.publicKey.toBuffer()],
      PROOFXI
    );
    const e: any = await proofxi.account.entry.fetch(entryPda);
    if (e.score.toString() === roundState.bestScore.toString()) winners.push({ p, entryPda });
  }
  for (const w of winners) {
    const winnerAta = getAssociatedTokenAddressSync(usdcMint, w.p.kp.publicKey);
    await proofxi.methods
      .payout()
      .accounts({
        caller: main.publicKey,
        round: roundPda,
        entry: w.entryPda,
        vault,
        vaultAuthority: vaultAuth,
        winnerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    ok(`paid ${w.p.name}`);
  }

  // --- assert balances -------------------------------------------------------
  step("Final balances & assertions");
  const potUsdc = Number(roundState.pot) / USDC;
  const share = potUsdc / winners.length;
  let allGood = true;
  for (const p of players) {
    const ata = getAssociatedTokenAddressSync(usdcMint, p.kp.publicKey);
    const bal = await usdcBalance(conn, ata);
    const isWinner = winners.some((w) => w.p === p);
    const expected = 100 - 10 + (isWinner ? share : 0);
    const good = Math.abs(bal - expected) < 1e-6;
    allGood &&= good;
    (good ? ok : bad)(`${p.name}: ${bal} USDC (expected ${expected}) ${good ? "✓" : "✗"}`);
  }
  const vaultBal = await usdcBalance(conn, vault);
  const vaultGood = Math.abs(vaultBal) < 1e-6;
  allGood &&= vaultGood;
  (vaultGood ? ok : bad)(`vault: ${vaultBal} USDC (expected 0) ${vaultGood ? "✓" : "✗"}`);

  step("Verdict");
  if (allGood) {
    ok("FULL ROUND SETTLED END-TO-END ON DEVNET. Jul 11 kill-switch: HIT EARLY. 🚦→🟢");
  } else {
    bad("kill-switch NOT hit — see mismatches above.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\n\x1b[31mfatal:\x1b[0m", e?.message ?? e);
  if (e?.logs) console.error(e.logs.join("\n"));
  process.exit(1);
});
