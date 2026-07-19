/**
 * ProofXI — data→proof spine (devnet, free World Cup tier).
 *
 * Proves the hardest unknown end to end:
 *   guest JWT  →  on-chain subscribe(1, 4)  →  activate  →  X-Api-Token
 *   →  pull a real World Cup fixture snapshot  →  pull a signed stat-validation proof.
 *
 * If the stat-validation payload comes back with Merkle proofs, the settlement
 * engine has real, verifiable ground to stand on.
 *
 * Run phases (each is idempotent):
 *   tsx scripts/setup.ts check       # read-only: fetch on-chain IDL, sanity-check config (no funds)
 *   tsx scripts/setup.ts keygen      # create the gitignored devnet keypair
 *   tsx scripts/setup.ts airdrop     # airdrop devnet SOL to that keypair
 *   tsx scripts/setup.ts subscribe   # subscribe on-chain + activate API token
 *   tsx scripts/setup.ts data        # pull a fixture + a stat-validation proof
 *   tsx scripts/setup.ts all         # subscribe (if needed) + data   [default]
 *
 * Public libs only (attributed): @coral-xyz/anchor, @solana/web3.js,
 * @solana/spl-token, axios, tweetnacl. No proprietary code.
 */

import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotent,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import axios, { AxiosError } from "axios";
import nacl from "tweetnacl";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Config (devnet, free World Cup tier). Facts from docs/tx-worldcup.md.
// ---------------------------------------------------------------------------

const NETWORK = "devnet" as const;

const CONFIG = {
  mainnet: {
    rpcUrl: "https://api.mainnet-beta.solana.com",
    apiOrigin: "https://txline.txodds.com",
    programId: new PublicKey("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA"),
    txlTokenMint: new PublicKey("Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL"),
  },
  devnet: {
    rpcUrl: "https://api.devnet.solana.com",
    apiOrigin: "https://txline-dev.txodds.com",
    programId: new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"),
    txlTokenMint: new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG"),
  },
} as const;

const { rpcUrl, apiOrigin, programId, txlTokenMint } = CONFIG[NETWORK];
const apiBaseUrl = `${apiOrigin}/api`;

// Free World Cup tier: service level 1 (60s delay), 4-week duration, standard bundle.
const SERVICE_LEVEL_ID = 1;
const DURATION_WEEKS = 4;
const SELECTED_LEAGUES: number[] = [];

// Devnet airdrop target. Subscribe + a couple of ATAs is cheap; 1 SOL is plenty.
const AIRDROP_SOL = 2;
const MIN_SOL = 0.2;

// Score stat keys we care about for football settlement (Participant scores).
const STAT_KEY_HOME = 1002;
const STAT_KEY_AWAY = 1003;

// ---------------------------------------------------------------------------
// Paths (keypair + session are gitignored; IDL is public and committed).
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const KEYPAIR_PATH = path.join(ROOT, "keypairs", "devnet.json");
const IDL_PATH = path.join(ROOT, "idl", "txoracle.devnet.json");
const SESSION_PATH = path.join(ROOT, ".txline-session.json");

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const log = (...a: unknown[]) => console.log(...a);
const step = (s: string) => log(`\n\x1b[1m▸ ${s}\x1b[0m`);
const ok = (...a: unknown[]) => log("  \x1b[32m✓\x1b[0m", ...a);
const info = (...a: unknown[]) => log("   ", ...a);

function describeError(e: unknown): string {
  if (e instanceof AxiosError) {
    const { response, config } = e;
    const where = `${config?.method?.toUpperCase()} ${config?.url}`;
    if (response) {
      const body =
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data);
      return `${where} → ${response.status} ${response.statusText}: ${body}`;
    }
    return `${where} → ${e.message}`;
  }
  return e instanceof Error ? e.message : String(e);
}

function loadJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(p: string, data: unknown) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Keypair / provider / program
// ---------------------------------------------------------------------------

function loadKeypair(): Keypair | null {
  const raw = loadJson<number[]>(KEYPAIR_PATH);
  return raw ? Keypair.fromSecretKey(Uint8Array.from(raw)) : null;
}

function requireKeypair(): Keypair {
  const kp = loadKeypair();
  if (!kp) {
    throw new Error(
      `no keypair at ${KEYPAIR_PATH}. Run: tsx scripts/setup.ts keygen`
    );
  }
  return kp;
}

function makeProvider(payer: Keypair): anchor.AnchorProvider {
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(payer),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);
  return provider;
}

/** Load the Txoracle program. IDL is fetched from chain on first run, then cached. */
async function loadProgram(
  provider: anchor.AnchorProvider
): Promise<anchor.Program> {
  let idl = loadJson<anchor.Idl>(IDL_PATH);
  if (!idl) {
    step("Fetching on-chain IDL for Txoracle (devnet)");
    idl = await anchor.Program.fetchIdl(programId, provider);
    if (!idl) {
      throw new Error(
        `Txoracle program ${programId.toBase58()} has no on-chain IDL. ` +
          `Drop a copy at ${IDL_PATH} from /documentation/programs/devnet.`
      );
    }
    writeJson(IDL_PATH, idl);
    ok(`cached IDL → ${path.relative(ROOT, IDL_PATH)}`);
  }
  const program = new anchor.Program(idl, provider);
  if (!program.programId.equals(programId)) {
    throw new Error(
      `IDL program ${program.programId.toBase58()} != devnet ${programId.toBase58()}`
    );
  }
  return program;
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

async function phaseCheck() {
  step("Config");
  info(`network        ${NETWORK}`);
  info(`rpc            ${rpcUrl}`);
  info(`apiOrigin      ${apiOrigin}`);
  info(`programId      ${programId.toBase58()}`);
  info(`txlTokenMint   ${txlTokenMint.toBase58()}`);

  // Read-only: use an ephemeral wallet just to fetch the IDL. No funds needed.
  const provider = makeProvider(Keypair.generate());
  const program = await loadProgram(provider);
  ok(`IDL loads, programId matches: ${program.programId.toBase58()}`);

  const hasSubscribe = program.idl.instructions.some(
    (i) => i.name === "subscribe"
  );
  const hasValidate = program.idl.instructions.some(
    (i) => i.name === "validateStat" || i.name === "validate_stat"
  );
  ok(`instruction subscribe present:     ${hasSubscribe}`);
  ok(`instruction validateStat present:  ${hasValidate}`);

  // Guest JWT is unauthenticated — safe to prove the API host is reachable now.
  step("Guest JWT reachability");
  const jwt = await getGuestJwt();
  ok(`POST /auth/guest/start → JWT (${jwt.slice(0, 12)}…, len ${jwt.length})`);

  log("\nCheck passed. Ready for keygen → airdrop → subscribe → data.");
}

function phaseKeygen(): Keypair {
  const existing = loadKeypair();
  if (existing) {
    step("Keypair");
    ok(`already present: ${existing.publicKey.toBase58()}`);
    return existing;
  }
  const kp = Keypair.generate();
  writeJson(KEYPAIR_PATH, Array.from(kp.secretKey));
  step("Keypair");
  ok(`generated (gitignored): ${kp.publicKey.toBase58()}`);
  info(path.relative(ROOT, KEYPAIR_PATH));
  return kp;
}

async function phaseAirdrop() {
  const kp = requireKeypair();
  const connection = new Connection(rpcUrl, "confirmed");
  step("Airdrop");
  const before = await connection.getBalance(kp.publicKey);
  info(`balance: ${(before / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  if (before >= MIN_SOL * LAMPORTS_PER_SOL) {
    ok("sufficient balance, skipping airdrop");
    return;
  }
  info(`requesting ${AIRDROP_SOL} SOL for ${kp.publicKey.toBase58()}…`);
  const sig = await connection.requestAirdrop(
    kp.publicKey,
    AIRDROP_SOL * LAMPORTS_PER_SOL
  );
  const bh = await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    { signature: sig, ...bh },
    "confirmed"
  );
  const after = await connection.getBalance(kp.publicKey);
  ok(`airdropped. balance: ${(after / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
}

async function phaseSubscribe() {
  const payer = requireKeypair();
  const provider = makeProvider(payer);
  const program = await loadProgram(provider);

  const balance = await provider.connection.getBalance(payer.publicKey);
  if (balance < MIN_SOL * LAMPORTS_PER_SOL) {
    throw new Error(
      `wallet ${payer.publicKey.toBase58()} has ${(
        balance / LAMPORTS_PER_SOL
      ).toFixed(4)} SOL. Run: tsx scripts/setup.ts airdrop`
    );
  }

  step("Subscribe on-chain (free tier: subscribe(1, 4))");

  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    program.programId
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    txlTokenMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    program.programId
  );
  const userTokenAccount = getAssociatedTokenAddressSync(
    txlTokenMint,
    payer.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // The program expects the caller's TxL ATA to already exist (even on the free
  // tier it charges 0 TxL against it). Create it idempotently first.
  await createAssociatedTokenAccountIdempotent(
    provider.connection,
    payer,
    txlTokenMint,
    payer.publicKey,
    { commitment: "confirmed" },
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  ok(`user TxL ATA ready: ${userTokenAccount.toBase58()}`);

  const txSig = await program.methods
    .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
    .accounts({
      user: payer.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: txlTokenMint,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  ok(`subscribe tx: ${txSig}`);
  info(`explorer: https://explorer.solana.com/tx/${txSig}?cluster=devnet`);

  step("Activate API token");
  const jwt = await getGuestJwt();
  const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
  const message = new TextEncoder().encode(messageString);
  const signatureBytes = nacl.sign.detached(message, payer.secretKey);
  const walletSignature = Buffer.from(signatureBytes).toString("base64");

  const activation = await axios.post(
    `${apiBaseUrl}/token/activate`,
    { txSig, walletSignature, leagues: SELECTED_LEAGUES },
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
  const apiToken: string = activation.data.token ?? activation.data;
  ok(`X-Api-Token issued (${String(apiToken).slice(0, 12)}…)`);

  writeJson(SESSION_PATH, {
    network: NETWORK,
    wallet: payer.publicKey.toBase58(),
    txSig,
    jwt,
    apiToken,
    activatedAt: new Date().toISOString(),
  });
  ok(`session saved → ${path.relative(ROOT, SESSION_PATH)}`);
}

type Session = {
  network: string;
  wallet: string;
  txSig: string;
  jwt: string;
  apiToken: string;
};

async function ensureSession(): Promise<Session> {
  const s = loadJson<Session>(SESSION_PATH);
  if (s?.jwt && s?.apiToken) return s;
  await phaseSubscribe();
  const fresh = loadJson<Session>(SESSION_PATH);
  if (!fresh) throw new Error("subscribe/activate did not produce a session");
  return fresh;
}

async function phaseData() {
  const session = await ensureSession();
  const http = axios.create({
    baseURL: apiOrigin,
    timeout: 30_000,
    headers: {
      Authorization: `Bearer ${session.jwt}`,
      "X-Api-Token": session.apiToken,
    },
  });

  // --- Fixtures: current window + historical windows -------------------------
  // The default snapshot returns fixtures starting from today onward. World Cup
  // matches earlier in the tournament are already played and carry real score
  // stats, so we also pull past windows via ?startEpochDay= (each returns the
  // 30 days *after* that day) to find a finished, scored fixture to prove.
  step("World Cup fixtures snapshot (current + historical)");
  const DAY_MS = 86_400_000;
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
      const list: any[] = Array.isArray(res.data) ? res.data : [];
      for (const f of list) byId.set(Number(f.FixtureId), f);
    } catch {
      // window may be empty; keep going.
    }
  }
  const fixtures = [...byId.values()].sort(
    (a, b) => Number(a.StartTime) - Number(b.StartTime)
  );
  ok(`${fixtures.length} distinct fixtures across ${windows.length} windows`);
  const nowMs = Date.now();
  // Prefer already-kicked-off fixtures (most likely to carry stats) first.
  const scanOrder = [...fixtures].sort((a, b) => {
    const ap = Number(a.StartTime) <= nowMs ? 0 : 1;
    const bp = Number(b.StartTime) <= nowMs ? 0 : 1;
    return ap - bp || Number(b.StartTime) - Number(a.StartTime);
  });
  for (const f of scanOrder.slice(0, 8)) {
    const started = Number(f.StartTime) <= nowMs ? "played/live" : "upcoming";
    info(
      `#${f.FixtureId}  ${f.Participant1} vs ${f.Participant2}  ` +
        `[${f.Competition}]  ${new Date(Number(f.StartTime)).toISOString()}  (${started})`
    );
  }
  if (fixtures.length === 0) {
    throw new Error("no fixtures returned — cannot locate a scores event");
  }

  // --- Find a fixture whose scores snapshot has a stat-bearing event ---------
  step("Locating a scored fixture (for a real proof)");
  let found:
    | { fixture: any; seq: number; statKeys: number[]; record: any }
    | null = null;

  for (const f of scanOrder) {
    const fixtureId = Number(f.FixtureId);
    let snap: any;
    try {
      const res = await http.get(
        `/api/scores/snapshot/${fixtureId}?asOf=${Date.now()}`
      );
      snap = res.data;
    } catch {
      continue; // no snapshot for this fixture yet
    }
    const records: any[] = Array.isArray(snap) ? snap : snap ? [snap] : [];
    // Pick the record carrying the most stats (a live/final score event).
    let best: { seq: number; statKeys: number[]; record: any } | null = null;
    for (const rec of records) {
      const seq = rec.seq ?? rec.Seq;
      const statsMap = rec.stats ?? rec.Stats ?? {};
      const statKeys = Object.keys(statsMap).map(Number);
      if (seq != null && statKeys.length > 0) {
        if (!best || statKeys.length > best.statKeys.length) {
          best = { seq: Number(seq), statKeys, record: rec };
        }
      }
    }
    if (best) {
      found = { fixture: f, ...best };
      ok(
        `fixture #${fixtureId} (${f.Participant1} vs ${f.Participant2}) ` +
          `→ seq ${best.seq}, stat keys [${best.statKeys.join(", ")}]`
      );
      break;
    }
  }

  if (!found) {
    log(
      "\nNo stat-bearing scores event found yet — every fixture in range is " +
        "still 'scheduled' with empty Stats (earliest WC kickoff is later today)."
    );
    log(
      "The full auth → subscribe → activate → data spine is PROVEN; the " +
        "stat-validation proof just needs a fixture that has actually scored. " +
        "Re-run `tsx scripts/setup.ts data` once a match is live/finished."
    );
    return;
  }

  // --- Stat-validation proof -------------------------------------------------
  step("Stat-validation proof (the settlement primitive's input)");
  const statKey = found.statKeys.includes(STAT_KEY_HOME)
    ? STAT_KEY_HOME
    : found.statKeys[0];
  const statKey2 = found.statKeys.includes(STAT_KEY_AWAY)
    ? STAT_KEY_AWAY
    : undefined;

  const fixtureId = Number(found.fixture.FixtureId);
  const params: Record<string, string | number> = {
    fixtureId,
    seq: found.seq,
    statKey,
  };
  if (statKey2 != null) params.statKey2 = statKey2;

  const proofRes = await http.get(`/api/scores/stat-validation`, { params });
  const proof = proofRes.data;

  ok(
    `GET /api/scores/stat-validation?fixtureId=${fixtureId}` +
      `&seq=${found.seq}&statKey=${statKey}` +
      (statKey2 != null ? `&statKey2=${statKey2}` : "")
  );

  const proofPath = path.join(ROOT, "proof-sample.json");
  writeJson(proofPath, proof);

  log("\n\x1b[1m=== SIGNED PROOF PAYLOAD ===\x1b[0m");
  log(JSON.stringify(proof, null, 2));
  log(`\n(saved → ${path.relative(ROOT, proofPath)})`);

  step("Proof sanity");
  ok(`ts:                 ${proof.ts}`);
  ok(`summary.fixtureId:  ${proof.summary?.fixtureId}`);
  ok(`eventStatRoot:      ${proof.eventStatRoot ? "present" : "MISSING"}`);
  ok(`statProof nodes:    ${proof.statProof?.length ?? "n/a"}`);
  ok(`subTreeProof nodes: ${proof.subTreeProof?.length ?? "n/a"}`);
  ok(`mainTreeProof nodes:${proof.mainTreeProof?.length ?? "n/a"}`);
  log(
    "\nThis payload is exactly what feeds program.methods.validateStat(...) — " +
      "the trustless settlement primitive. The hardest unknown is solved."
  );
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getGuestJwt(): Promise<string> {
  const res = await axios.post(`${apiOrigin}/auth/guest/start`);
  const jwt: string = res.data.token ?? res.data;
  if (!jwt || typeof jwt !== "string") {
    throw new Error(`unexpected /auth/guest/start response: ${JSON.stringify(res.data)}`);
  }
  return jwt;
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function main() {
  const phase = (process.argv[2] ?? "all").toLowerCase();
  switch (phase) {
    case "check":
      await phaseCheck();
      break;
    case "keygen":
      phaseKeygen();
      break;
    case "airdrop":
      await phaseAirdrop();
      break;
    case "subscribe":
      await phaseSubscribe();
      break;
    case "data":
      await phaseData();
      break;
    case "all":
      await ensureSession();
      await phaseData();
      break;
    default:
      throw new Error(
        `unknown phase "${phase}". Use: check | keygen | airdrop | subscribe | data | all`
      );
  }
}

main().catch((e) => {
  console.error("\n\x1b[31m✗ failed:\x1b[0m", describeError(e));
  process.exit(1);
});
