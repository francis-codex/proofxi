/**
 * Light devnet reads over raw JSON-RPC (no @solana/web3.js in the bundle).
 * Used to prove the site is genuinely talking to the deployed programs on
 * Solana devnet — reads the proofxi program account + the test-USDC mint
 * supply, live, from the browser. Best-effort: callers render cached facts
 * if the RPC is slow or throttled.
 */

const RPC = "https://api.devnet.solana.com";

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

export type DevnetSnapshot = {
  slot: number;
  programExecutable: boolean;
  usdcSupply: number; // ui amount
  usdcDecimals: number;
};

export async function readDevnet(
  program: string,
  mint: string
): Promise<DevnetSnapshot> {
  const [slot, acct, supply] = await Promise.all([
    rpc<number>("getSlot", []),
    rpc<{ value: { executable: boolean } | null }>("getAccountInfo", [
      program,
      { encoding: "base64" },
    ]),
    rpc<{ value: { uiAmount: number; decimals: number } }>("getTokenSupply", [
      mint,
    ]),
  ]);
  return {
    slot,
    programExecutable: acct.value?.executable ?? false,
    usdcSupply: supply.value.uiAmount,
    usdcDecimals: supply.value.decimals,
  };
}

export function explorer(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}
