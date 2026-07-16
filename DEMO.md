# ProofXI — demo film (≤5 min)

The demo film IS the product. Simulated/replayed feeds are allowed; every screen
below is the real deployed build (**proofxi.vercel.app**) wired to the deployed
devnet programs. Record desktop at 1440-wide, dark room, no cursor clutter, the
dense receipt reads best there. Target ~4:20.

**Structure note:** we open cold on the cheat getting rejected. Every prediction
market — and every rival in this track — says "provably fair." Almost none can
*show* the proof, and none can show it rejecting a tamper live. That is our one
unbeatable moment, so it goes first, then we earn it back with the mechanics.

---

## COLD OPEN — the chain overrules a cheat (0:00–0:35) — `#review`
- Start already scrolled to the **review** card: score bug reads `PAR 0 : 0 FRA · FT`,
  lower-third `REVIEWING · PARAGUAY TO WIN`.
- Toggle **TRY TO RIG IT**, click **RUN VAR REVIEW**. Evidence stack scans, **ROOT**
  throws the red ✕, the **OVERTURNED** stamp slams down.
- VO: *"This is a settled prediction market. I'm the operator, and I'm going to
  cheat — I'll feed a tampered result to move the payout. Watch. …The chain just
  overturned me. Escrow stays locked. Let me show you why that's impossible to beat."*

## WHAT IT IS (0:35–0:55) — `#top`
- Cut up to the hero: **"EVERY RESULT GOES TO VAR. THE CHAIN MAKES THE CALL."**
- VO: *"ProofXI is VAR for prediction markets. Every result goes to an on-chain
  review that settles the bet by cryptographic proof — not by an operator, not by
  a trusted feed. Built on TxLINE for the World Cup."*

## 1 · REAL DATA IN (0:55–1:35) — `#live`
- Click **KICK OFF**. The TxLINE scores stream ticks in over SSE — minute climbs,
  events stack (SHOT, CORNER, SAVE…), `POWERED BY TXLINE`.
- VO: *"It starts with real data. This is a live TxLINE scores feed over
  server-sent events — Paraguay–France, and it finishes nil–nil."*
- At full time the feed seals the stat: `1002 HOME_GOALS=0 · PERIOD FT`. Click
  **SEND TO VAR ▸**.
- VO: *"Full time. The stat is sealed and Merkle-proven by TxLINE. Now it goes to review."*

## 2 · THE REVIEW, HONEST — how the proof works (1:35–2:45) — `#review`
- Make sure the toggle is back on **HONEST**. Click **RUN VAR REVIEW**. Let the
  evidence stack unfold: STAT → LEAF → PATH → ROOT → SUMM → SIGN → CPI — each hash
  is the real bytes of the proof.
- VO: *"TxLINE serves a Merkle-proven stat: the leaf, its inclusion path, the
  event-stat root, a signed snapshot. On-chain, `settle_market` rebuilds the
  market's predicate itself and CPIs into `validate_stat`. The verdict is the
  program's own return data — no keeper, no admin, nothing to trust."*
- The **CONFIRMED** stamp lands. VO: *"Confirmed on-chain. Funds released to the
  winners. Final, and it cannot be contested."*

## 3 · THE RIG-IT, EXPLAINED — pay off the cold open (2:45–3:20) — same card
- Toggle **TRY TO RIG IT** again, run it. Same flow — tampered **LEAF** flags, then
  **ROOT** rejects with the red ✕ → **OVERTURNED**.
- VO: *"So back to the cheat. When I tamper the stat, the root I recompute no longer
  matches TxLINE's signed root. `validate_stat` aborts — InvalidStatProof — escrow
  stays locked, and the settlement reverts. This is the custom check-gate the track
  asks for, and it's proven on devnet in `scripts/adversarial.ts`. Not 'trust us
  it's fair.' The chain enforces it."*

## 4 · BUILD A SLATE — real escrow (3:20–3:55) — `#slate`
- Pick outcomes, set weights, choose a captain. Point at **DEVNET · SLOT n** — a
  live chain read, ticking. Click **ENTER SLATE**.
- VO: *"Playing is a slate of markets — pick, weight, captain for 2×. Ten test-USDC
  escrows to the round vault. That maps to `proofxi::enter`, and it's real on devnet."*

## 5 · SETTLEMENT & PAYOUT (3:55–4:25) — `#payout`
- Each market resolution shows **CONFIRMED** with its proof root — the verifiable
  receipt behind every call. Expand player_a: wins 105–0, takes the 20-USDC pot.
- VO: *"Every outcome is proven, scored, and paid by `proofxi::payout` —
  winner-take-all, ties split, dust stays in the vault. Settlement you can audit,
  not a scoreboard you have to trust. That's ProofXI."*
- End card: **proofxi.vercel.app** · `VERIFY ON DEVNET ↗`.

---

## Lower-thirds to keep on screen
- program `3wqZbXRs…qBtgNCE` · txoracle `6pW64gN1…715wyP2J` · devnet
- `POWERED BY TXLINE` on the live card and the receipt.

## Delivery notes
- Total ~4:20. If you need to trim to hit 5:00 hard, cut section 4 (slate) to a
  single 15-sec beat — sections 2 + 3 (the proof + the rejected cheat) are the ones
  that win the track; never cut those.
- Record HONEST first-take muscle memory: cold-open is on the **adversarial** toggle,
  section 2 must be flipped back to **HONEST**, section 3 flips to adversarial again.

## Deliverables checklist
- [x] Deployed site — **https://proofxi.vercel.app** (Vercel, root dir `web/`)
- [ ] Public repo — flip right before submit: `gh repo edit francis-codex/proofxi --visibility public`
- [x] Tech doc naming TxLINE endpoints — `TECH.md`
- [ ] ≤5-min video (this script)
