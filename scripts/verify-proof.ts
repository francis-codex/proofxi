/**
 * ProofXI — Phase 1 de-risk client.
 *
 * Drives the on-chain proof: builds the real Txoracle `validate_stat` instruction
 * from proof-sample.json, hands its serialized bytes to our deployed
 * `proof_verifier` program, which CPIs into Txoracle, reads the returned bool via
 * get_return_data, and records it on-chain.
 *
 * We run it TWICE with the same proof but flipped predicates so the recorded
 * outcome must flip too — proof that the bool is genuinely read from the CPI,
 * not fabricated:
 *   - score(1002) EqualTo 0     → expect TRUE  (Paraguay 0)
 *   - score(1002) GreaterThan 0 → expect FALSE (0 is not > 0)
 */

import * as anchor from "@coral-xyz/anchor";
import anchorPkg from "@coral-xyz/anchor";
const { BN } = anchorPkg;
import {
  Connection,
  Keypair,
  PublicKey,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const RPC = "https://api.devnet.solana.com";
const TXORACLE = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const DAY_MS = 86_400_000;

const log = (...a: unknown[]) => console.log(...a);
const step = (s: string) => log(`\n\x1b[1m▸ ${s}\x1b[0m`);
const ok = (...a: unknown[]) => log("  \x1b[32m✓\x1b[0m", ...a);
const bad = (...a: unknown[]) => log("  \x1b[31m✗\x1b[0m", ...a);

function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

/** API binary fields arrive as number[] (or base64 / 0x-hex). Normalize to [u8;32]. */
function toBytes32(value: string | number[] | Uint8Array): number[] {
  const bytes = Array.isArray(value)
    ? Uint8Array.from(value)
    : value instanceof Uint8Array
      ? value
      : value.startsWith("0x")
        ? Buffer.from(value.slice(2), "hex")
        : Buffer.from(value, "base64");
  if (bytes.length !== 32) {
    throw new Error(`expected 32 bytes, got ${bytes.length}`);
  }
  return Array.from(bytes);
}

function toProofNodes(
  nodes: Array<{ hash: any; isRightSibling: boolean }> | null
) {
  return (nodes ?? []).map((n) => ({
    hash: toBytes32(n.hash),
    isRightSibling: n.isRightSibling,
  }));
}

type Comparison =
  | { equalTo: {} }
  | { greaterThan: {} }
  | { lessThan: {} };

async function main() {
  const proof = loadJson<any>(path.join(ROOT, "proof-sample.json"));
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(loadJson<number[]>(path.join(ROOT, "keypairs", "devnet.json")))
  );

  const connection = new Connection(RPC, "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(payer),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const txoracleIdl = loadJson<anchor.Idl>(
    path.join(ROOT, "idl", "txoracle.devnet.json")
  );
  const verifierIdl = loadJson<anchor.Idl>(
    path.join(ROOT, "target", "idl", "proof_verifier.json")
  );
  const txoracle = new anchor.Program(txoracleIdl, provider);
  const verifier = new anchor.Program(verifierIdl, provider);

  step("Inputs");
  log(`   proof fixture:   ${proof.summary.fixtureId}`);
  log(`   statToProve:     key ${proof.statToProve.key} value ${proof.statToProve.value} period ${proof.statToProve.period}`);
  log(`   verifier program:${verifier.programId.toBase58()}`);
  log(`   txoracle program:${TXORACLE.toBase58()}`);

  // ---- Shared validate_stat args (single stat: home score, key 1002) --------
  const targetTs = new BN(proof.summary.updateStats.minTimestamp);
  const epochDay = Math.floor(
    Number(proof.summary.updateStats.minTimestamp) / DAY_MS
  );
  const [dailyScoresPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), new BN(epochDay).toArrayLike(Buffer, "le", 2)],
    TXORACLE
  );

  const fixtureSummary = {
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

  const [resultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("proof_result"), payer.publicKey.toBuffer()],
    verifier.programId
  );

  async function run(label: string, comparison: Comparison, threshold: number, expected: boolean) {
    step(`CPI run: ${label}  (expect ${expected})`);
    const predicate = { threshold, comparison };

    // Build the exact validate_stat instruction; forward only its raw data.
    const vsIx = await txoracle.methods
      .validateStat(targetTs, fixtureSummary, fixtureProof, mainTreeProof, predicate, statA, null, null)
      .accounts({ dailyScoresMerkleRoots: dailyScoresPda })
      .instruction();

    try {
      const sig = await verifier.methods
        .verifyProof(vsIx.data)
        .accounts({
          payer: payer.publicKey,
          result: resultPda,
          dailyScoresMerkleRoots: dailyScoresPda,
          txoracleProgram: TXORACLE,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
        ])
        .rpc();

      ok(`tx ${sig}`);
      const acct: any = await verifier.account.proofResult.fetch(resultPda);
      const pass = acct.outcome === expected;
      (pass ? ok : bad)(
        `on-chain ProofResult.outcome = ${acct.outcome}  (expected ${expected}) ` +
          `${pass ? "✓ MATCH" : "✗ MISMATCH"}`
      );
      log(`     recorded txoracle: ${acct.txoracle.toBase58()}`);
      log(`     explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
      return pass;
    } catch (e: any) {
      bad(`CPI failed: ${e.message ?? e}`);
      if (e.logs) log(e.logs.join("\n"));
      return false;
    }
  }

  // fixture 18257865 = France 4–0 England → home score (1002) is 4.
  const r1 = await run("score(1002) EqualTo 0", { equalTo: {} }, 0, false);
  const r2 = await run("score(1002) GreaterThan 0", { greaterThan: {} }, 0, true);

  step("Verdict");
  if (r1 && r2) {
    ok("CPI into validate_stat works AND the returned bool is read on-chain.");
    ok("Same proof, flipped predicate → flipped recorded outcome. Thesis proven.");
  } else {
    bad("de-risk INCOMPLETE — see failures above.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\n\x1b[31mfatal:\x1b[0m", e);
  process.exit(1);
});
