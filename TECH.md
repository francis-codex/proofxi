# ProofXI — technical overview

**VAR for prediction markets.** Every market outcome goes to an on-chain review
that is final and cannot be rigged. The result is decided by a cryptographic
proof settled on-chain — not by an operator.

Track: **Prediction Markets & Settlement** (TxODDS World Cup hackathon).
Network: **Solana devnet**. Data: **TxLINE**.

---

## The thesis in one line

`settle_market` rebuilds a market's predicate **on-chain** from the stored
market definition, CPIs into TxLINE's `Txoracle.validate_stat`, and records the
program's own `get_return_data` bool as the outcome. A settler can supply the
bulky Merkle-proof data, but **cannot prove one proposition and record another** —
the predicate (stat keys + operator + comparison + threshold) is reconstructed
from chain state, not taken from the caller.

This is the exact behaviour the custom check-gate + adversarial binding tests
demonstrate, and what the on-screen VAR review visualizes.

---

## TxLINE endpoints used

Base origin (devnet): `https://txline-dev.txodds.com`

| Purpose | Method | Endpoint |
| --- | --- | --- |
| Guest session (JWT) | `POST` | `/auth/guest/start` |
| Activate → `X-Api-Token` | `POST` | `/token/activate` |
| Fixtures snapshot (`?startEpochDay=`) | `GET` | `/api/fixtures/snapshot` |
| Scores snapshot (per fixture) | `GET` | `/api/scores/snapshot/{fixtureId}` |
| **Merkle stat-validation proof** | `GET` | `/api/scores/stat-validation` |
| **Real-time scores stream (SSE)** | `GET` | `/api/scores/stream` |
| Merkle proof for fixture statistics | `GET` | see `docs/tx-get-a-merkle-proof-for-fixture-statistics.md` |

On-chain data subscription is via the Txoracle program's `subscribe`
instruction (free World Cup tier: `serviceLevelId=1`, `durationWeeks=4`).

### Where each endpoint shows up in the product

- **Live match card** (`web/components/LiveMatchCard.tsx`) mirrors
  `/api/scores/stream`. It consumes a genuine Server-Sent-Events stream
  (`web/app/api/stream/route.ts`, `text/event-stream`) via a native browser
  `EventSource`. The feed data is a **replay** of the fixture's `ScoreStat`
  sequence (replay is explicitly allowed for the demo); the transport is real SSE.
- **VAR receipt** (`web/components/VarReceipt.tsx`) renders the actual bytes of a
  real `stat-validation` proof (`/api/scores/stat-validation`) pulled on devnet
  and saved to `proof-sample.json` — every hash on screen is the hex of those
  bytes. The adversarial path tampers one leaf byte, which breaks the Merkle path
  exactly as the on-chain check does.
- **Slate builder / leaderboard** read the deployed program + test-USDC mint live
  from devnet over JSON-RPC (`web/lib/chain.ts`) to prove the browser is talking
  to the real chain (`DEVNET · SLOT n`).

---

## On-chain programs (Solana devnet)

| Program | Address | Role |
| --- | --- | --- |
| `Txoracle` (TxLINE) | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` | serves `validate_stat`; the proof gate |
| `proofxi` | `3wqZbXRsECPBib3sfuHGFtZis9WP9JENm3JHxqBtgNCE` | rounds, escrow, settlement, payout |
| `proof_verifier` | `FLfi8rshUqV8cn71Z1nj29bFLmDdAhiHsVBoqLvhia1F` | minimal CPI de-risk (Phase 1) |
| test-USDC mint | `85s4zWGJ5FLSG1RtqiekE5QQBcNwSvtBgmbEy7UwmwDD` | 6-decimal devnet SPL, self-serve faucet |

### `proofxi` instructions

`faucet` · `create_round` · `enter` · `settle_market` (the CPI seam) · `score` · `payout`

- **Markets** are boolean propositions over TxLINE stat keys, e.g. home win =
  `STAT[1002] − STAT[1003] > 0`. Only OUTCOMES are proven via `validate_stat`;
  odds-weights are stored game params committed at `enter` (not proven, per v1 scope).
- **Scoring**: a correct pick scores its odds-weight; the captain scores 2×.
  Highest total takes the pot; ties split; dust stays in the vault.

### Adversarial binding (proven on devnet, `scripts/adversarial.ts`)

1. Tampered stat value → `InvalidStatProof` (Txoracle rejects the fake Merkle leaf **inside the CPI**).
2. Swapped stat keys → `StatMismatch` (our on-chain predicate binding).
3. Injected second stat into a single-stat market → `UnexpectedSecondStat`.

Honest settle still passes. This is the "watch me try to rig it → the chain
rejects it" demo beat, surfaced in the receipt's **TRY TO RIG IT** toggle.

---

## Frontend stack

Next.js 14 (App Router) · TypeScript · Tailwind v3 · framer-motion. Deployed on
Vercel. Design: World Cup broadcast graphics × settlement terminal — heavy
condensed display (Anton), grotesque body (Archivo), mono for all proof/hash/stat
data (JetBrains Mono); near-monochrome ink + bone with two graphic colors used
nowhere else — confirm-green and overturn-red.

See `README.md` for run + deploy instructions.
