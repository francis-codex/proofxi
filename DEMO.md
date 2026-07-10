# ProofXI — demo film (≤5 min)

The demo film IS the product. Simulated/replayed feeds are allowed; every screen
below is the real deployed build connected to the deployed programs. Record at
1440-wide, dark room, no cursor clutter. Target ~4:15.

## Cold open (0:00–0:25)
- Land on the hero. Headline: **"EVERY RESULT GOES TO VAR. THE CHAIN MAKES THE CALL."**
- VO: *"Prediction markets have one weak point — who decides the result? ProofXI
  sends every result to VAR. The chain makes the call, and it can't be rigged."*

## 1 · The live match (0:25–1:05) — `#live`
- Click **KICK OFF**. The TxLINE scores stream ticks in over SSE — minute climbs,
  events stack, `POWERED BY TXLINE`.
- VO: *"This is a live TxLINE scores feed. Paraguay–France, and it finishes nil–nil."*
- At full time the feed seals the stat: `k1002=0 · p4`. Click **SEND TO VAR ▸**.

## 2 · The review — the money shot (1:05–2:20) — `#review`
- Click **RUN VAR REVIEW**. Let the evidence stack unfold: STAT → LEAF → PATH →
  ROOT → SUMM → SIGN → CPI, each hash the real bytes of the proof.
- VO: *"The stat goes to an on-chain review. TxLINE serves a Merkle-proven stat;
  `settle_market` rebuilds the market's predicate on-chain and CPIs into
  `validate_stat`. The verdict is the program's own return data."*
- The **CONFIRMED** stamp lands. *"Confirmed. Funds released. Final, and it cannot
  be contested."*

## 3 · Try to rig it (2:20–3:05) — same component
- Toggle **TRY TO RIG IT**, run again. Same flow, tampered leaf → **ROOT** rejects
  with the red X → **OVERTURNED**.
- VO: *"Now I'm the settler and I cheat — I feed a tampered stat. The recomputed
  root no longer matches TxLINE's signed root, `validate_stat` aborts, escrow
  stays locked. The chain overturns me. This is the custom check-gate the track
  asks for, proven on devnet in `scripts/adversarial.ts`."*

## 4 · Build a slate (3:05–3:45) — `#slate`
- Pick outcomes, set weights, choose a captain. Note **DEVNET · SLOT n** — live
  chain read. Click **ENTER SLATE**.
- VO: *"Entry is a slate of markets. Ten test-USDC escrows to the round vault —
  this maps to `proofxi::enter`, and it's real on devnet."*

## 5 · Settlement & payout (3:45–4:15) — `#payout`
- Each market resolution shows **CONFIRMED** with the proof root — the verifiable
  receipt behind every call. player_a wins 105–0 and takes the 20-USDC pot.
- VO: *"Every outcome is proven, scored, and paid by `proofxi::payout`.
  Winner-take-all, ties split. Settlement you can audit — not a scoreboard you
  have to trust. That's ProofXI."*

## Lower-thirds to keep on screen
- program `3wqZbXRs…qBtgNCE` · txoracle `6pW64gN1…715wyP2J` · devnet
- `POWERED BY TXLINE` on the live card and receipt.

## Deliverables checklist
- [x] Deployed site (Vercel, root dir `web/`)
- [x] Public repo
- [x] Tech doc naming TxLINE endpoints — `TECH.md`
- [ ] ≤5-min video (this script)
