/**
 * Creates a fresh devnet "test-USDC" SPL mint (6 decimals) whose mint authority
 * is the proofxi program's ["usdc_mint_authority"] PDA — so the on-chain
 * `faucet` instruction can mint it to anyone. This is clearly TEST-ONLY money so
 * judges can self-fund at zero cost. Idempotent: reuses the mint in the config.
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, ".proofxi-config.json");
const RPC = "https://api.devnet.solana.com";
const PROOFXI = new PublicKey("3wqZbXRsECPBib3sfuHGFtZis9WP9JENm3JHxqBtgNCE");
const DECIMALS = 6;

async function main() {
  const existing = fs.existsSync(CONFIG_PATH)
    ? JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"))
    : {};
  if (existing.usdcMint) {
    console.log("test-USDC mint already exists:", existing.usdcMint);
    return;
  }

  const payer = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(fs.readFileSync(path.join(ROOT, "keypairs", "devnet.json"), "utf8"))
    )
  );
  const connection = new Connection(RPC, "confirmed");

  const [mintAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("usdc_mint_authority")],
    PROOFXI
  );

  const mint = await createMint(connection, payer, mintAuthority, null, DECIMALS);

  const config = {
    ...existing,
    proofxiProgram: PROOFXI.toBase58(),
    usdcMint: mint.toBase58(),
    usdcMintAuthority: mintAuthority.toBase58(),
    decimals: DECIMALS,
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log("created test-USDC mint:", mint.toBase58());
  console.log("mint authority (PDA):", mintAuthority.toBase58());
  console.log("saved →", path.relative(ROOT, CONFIG_PATH));
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
