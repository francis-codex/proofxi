# ProofXI

**VAR for prediction markets.** A fantasy World Cup pick'em where every result
goes to an on-chain review that is final and cannot be rigged — settled
trustlessly by TxLINE cryptographic proofs on Solana.

Built for the TxODDS World Cup hackathon — *Prediction Markets & Settlement* track.

> Like football's VAR reviews a call and makes it incontestable, ProofXI reviews
> the stat and settles the market trustlessly. The name is the mechanic.

- **What it does:** enter a slate of boolean markets, escrow test-USDC, and when
  the match finalizes each outcome is proven on-chain via TxLINE's `validate_stat`
  and the pot is paid out — no operator, no keeper, no trust.
- **The demo beat:** the *VAR receipt* unfolds the Merkle evidence and stamps
  `CONFIRMED`. Flip to **TRY TO RIG IT** and the identical flow with a tampered
  input gets `OVERTURNED` — the chain rejects the cheat.

Full architecture and the TxLINE endpoints used: [`TECH.md`](./TECH.md).
Demo film script: [`DEMO.md`](./DEMO.md).

---

## Repo layout

```
web/          Next.js frontend (the deployed site)
programs/     Anchor programs — proofxi (settlement) + proof_verifier (CPI de-risk)
scripts/      devnet proving scripts (setup, phase3 round, adversarial)
docs/         TxLINE API reference dumps
proof-sample.json   a real stat-validation proof pulled on devnet
```

## Run the site locally

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

The live match card streams over a real SSE endpoint (`/api/stream`); the slate
builder and leaderboard read the deployed program + test-USDC mint live from
Solana devnet.

## Deploy to Vercel

The Next app lives in `web/`. In the Vercel project settings:

- **Root Directory:** `web`
- Framework preset: **Next.js** (auto-detected)
- Build command / install: defaults

```bash
# or from the CLI, inside web/
cd web && npx vercel --prod
```

No environment variables are required — the site reads public devnet state and
replays a real TxLINE proof shipped in the bundle.

## Reproduce the on-chain proof (optional)

```bash
npm install                       # root deps (anchor, web3.js, spl-token)
npm run setup                     # TxLINE auth → subscribe → pull a real proof
npx tsx scripts/phase3.ts         # create_round → enter → settle (CPI) → payout
npx tsx scripts/adversarial.ts    # three cheats, each reverts on devnet
```

---

Solana **devnet** only. Test-USDC is clearly labelled test money with a
self-serve faucet. Built fresh with public libraries.
