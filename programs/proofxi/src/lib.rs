use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::{get_return_data, invoke},
};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("3wqZbXRsECPBib3sfuHGFtZis9WP9JENm3JHxqBtgNCE");

/// The Txoracle devnet program we settle against.
const TXORACLE: Pubkey =
    anchor_lang::solana_program::pubkey!("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

/// Anchor discriminator for Txoracle's `validate_stat` instruction (from its IDL).
const VALIDATE_STAT_DISCRIMINATOR: [u8; 8] = [107, 197, 232, 90, 191, 136, 105, 185];

const MAX_MARKETS: usize = 8;
const MAX_PICKS: usize = 8;
/// Faucet hands out at most 1,000 test-USDC (6 decimals) per call.
const FAUCET_CAP: u64 = 1_000_000_000;
const MS_PER_DAY: i64 = 86_400_000;

/// ProofXI — fantasy World Cup, trustlessly settled.
///
/// Players build a slate of boolean market predictions, pay a test-USDC entry
/// fee into a round vault, and commit their picks + odds-weights on-chain. After
/// lock, each market's OUTCOME is proven by CPI'ing Txoracle's `validate_stat`
/// (the exact phase-1 seam) — and crucially the *predicate is built by this
/// program from the stored market definition*, so a settler can supply the proof
/// data but cannot prove one thing and record another. Scoring is deterministic
/// (correct pick scores its odds-weight, captain 2x); the highest total takes the
/// pot, ties split.
#[program]
pub mod proofxi {
    use super::*;

    /// Mint test-USDC to the caller so judges can self-fund. Clearly test-only.
    pub fn faucet(ctx: Context<Faucet>, amount: u64) -> Result<()> {
        require!(amount > 0 && amount <= FAUCET_CAP, ProofxiError::FaucetAmount);
        let bump = ctx.bumps.mint_authority;
        let seeds: &[&[u8]] = &[b"usdc_mint_authority", &[bump]];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.recipient_ata.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;
        Ok(())
    }

    /// Open a round: fixtures + boolean market defs, entry fee, lock time.
    pub fn create_round(
        ctx: Context<CreateRound>,
        round_id: u64,
        entry_fee: u64,
        lock_time: i64,
        markets: Vec<MarketDef>,
    ) -> Result<()> {
        require!(!markets.is_empty() && markets.len() <= MAX_MARKETS, ProofxiError::MarketCount);
        for m in &markets {
            require!(m.comparison <= 2, ProofxiError::BadMarket);
            require!(!m.use_second || m.op <= 1, ProofxiError::BadMarket);
        }

        let round = &mut ctx.accounts.round;
        round.authority = ctx.accounts.authority.key();
        round.round_id = round_id;
        round.usdc_mint = ctx.accounts.usdc_mint.key();
        round.vault = ctx.accounts.vault.key();
        round.entry_fee = entry_fee;
        round.lock_time = lock_time;
        round.entrants = 0;
        round.pot = 0;
        round.markets = markets
            .into_iter()
            .map(|mut m| {
                m.settled = false;
                m.outcome = false;
                m
            })
            .collect();
        round.settled_count = 0;
        round.best_score = 0;
        round.winner_count = 0;
        round.scored_count = 0;
        round.paid_count = 0;
        round.bump = ctx.bumps.round;
        round.vault_bump = ctx.bumps.vault_authority;
        Ok(())
    }

    /// Enter a round: pay entry fee into the vault, commit picks + odds-weights.
    pub fn enter(ctx: Context<Enter>, picks: Vec<Pick>, captain_index: u8) -> Result<()> {
        let round = &mut ctx.accounts.round;
        let now = Clock::get()?.unix_timestamp;
        require!(now < round.lock_time, ProofxiError::RoundLocked);
        require!(picks.len() == round.markets.len(), ProofxiError::PickCount);
        require!((captain_index as usize) < picks.len(), ProofxiError::BadCaptain);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player_ata.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.player.to_account_info(),
                },
            ),
            round.entry_fee,
        )?;

        let entry = &mut ctx.accounts.entry;
        entry.round = round.key();
        entry.player = ctx.accounts.player.key();
        entry.captain_index = captain_index;
        entry.scored = false;
        entry.paid = false;
        entry.score = 0;
        entry.picks = picks;
        entry.bump = ctx.bumps.entry;

        round.entrants = round.entrants.checked_add(1).unwrap();
        round.pot = round.pot.checked_add(round.entry_fee).unwrap();
        Ok(())
    }

    /// Settle one market by proving its outcome via a Txoracle `validate_stat` CPI.
    ///
    /// The caller supplies only the proof data (Merkle proofs + stat terms). The
    /// PREDICATE is rebuilt here from the stored market definition, and the stat
    /// keys are checked against it — so the recorded outcome is exactly what the
    /// proof proves about the market's own proposition, nothing else.
    pub fn settle_market(
        ctx: Context<SettleMarket>,
        market_idx: u8,
        ts: i64,
        summary: ScoresBatchSummary,
        fixture_proof: Vec<ProofNode>,
        main_tree_proof: Vec<ProofNode>,
        stat_a: StatTerm,
        stat_b: Option<StatTerm>,
    ) -> Result<()> {
        let round = &mut ctx.accounts.round;
        let now = Clock::get()?.unix_timestamp;
        require!(now >= round.lock_time, ProofxiError::RoundOpen);

        let idx = market_idx as usize;
        require!(idx < round.markets.len(), ProofxiError::BadMarketIndex);
        let market = round.markets[idx];
        require!(!market.settled, ProofxiError::AlreadySettled);

        // Bind the proof to this market's proposition.
        require!(stat_a.stat_to_prove.key == market.stat_key_a, ProofxiError::StatMismatch);
        let op = if market.use_second {
            let b = stat_b.as_ref().ok_or(ProofxiError::MissingSecondStat)?;
            require!(b.stat_to_prove.key == market.stat_key_b, ProofxiError::StatMismatch);
            Some(if market.op == 0 { BinaryExpression::Add } else { BinaryExpression::Subtract })
        } else {
            require!(stat_b.is_none(), ProofxiError::UnexpectedSecondStat);
            None
        };
        let predicate = TraderPredicate {
            threshold: market.threshold,
            comparison: match market.comparison {
                0 => Comparison::GreaterThan,
                1 => Comparison::LessThan,
                _ => Comparison::EqualTo,
            },
        };

        // The daily-roots PDA must be the one Txoracle owns for this ts.
        let epoch_day = (ts / MS_PER_DAY) as u16;
        let (expected_daily, _) = Pubkey::find_program_address(
            &[b"daily_scores_roots", &epoch_day.to_le_bytes()],
            &TXORACLE,
        );
        require_keys_eq!(
            expected_daily,
            ctx.accounts.daily_scores_merkle_roots.key(),
            ProofxiError::WrongDailyRootAccount
        );
        require_keys_eq!(ctx.accounts.txoracle_program.key(), TXORACLE, ProofxiError::WrongTxoracle);

        // Serialize the validate_stat instruction data (8-byte disc + borsh args).
        let mut data = Vec::with_capacity(512);
        data.extend_from_slice(&VALIDATE_STAT_DISCRIMINATOR);
        ts.serialize(&mut data)?;
        summary.serialize(&mut data)?;
        fixture_proof.serialize(&mut data)?;
        main_tree_proof.serialize(&mut data)?;
        predicate.serialize(&mut data)?;
        stat_a.serialize(&mut data)?;
        stat_b.serialize(&mut data)?;
        op.serialize(&mut data)?;

        let ix = Instruction {
            program_id: TXORACLE,
            accounts: vec![AccountMeta::new_readonly(
                ctx.accounts.daily_scores_merkle_roots.key(),
                false,
            )],
            data,
        };
        invoke(
            &ix,
            &[
                ctx.accounts.daily_scores_merkle_roots.to_account_info(),
                ctx.accounts.txoracle_program.to_account_info(),
            ],
        )?;

        let (returning_program, ret) =
            get_return_data().ok_or(ProofxiError::NoReturnData)?;
        require_keys_eq!(returning_program, TXORACLE, ProofxiError::WrongTxoracle);
        let outcome = ret.first().copied().unwrap_or(0) != 0;

        msg!("market {} proven outcome = {}", idx, outcome);
        round.markets[idx].outcome = outcome;
        round.markets[idx].settled = true;
        round.settled_count = round.settled_count.checked_add(1).unwrap();
        Ok(())
    }

    /// Deterministic scoring for one entry once every market is settled.
    pub fn score(ctx: Context<ScoreEntry>) -> Result<()> {
        let round = &mut ctx.accounts.round;
        require!(
            round.settled_count as usize == round.markets.len(),
            ProofxiError::NotAllSettled
        );
        let entry = &mut ctx.accounts.entry;
        require!(!entry.scored, ProofxiError::AlreadyScored);

        let mut total: u64 = 0;
        for (i, pick) in entry.picks.iter().enumerate() {
            if pick.prediction == round.markets[i].outcome {
                let mut pts = pick.odds_weight as u64;
                if i == entry.captain_index as usize {
                    pts = pts.checked_mul(2).unwrap();
                }
                total = total.checked_add(pts).unwrap();
            }
        }
        entry.score = total;
        entry.scored = true;
        round.scored_count = round.scored_count.checked_add(1).unwrap();

        if total > round.best_score {
            round.best_score = total;
            round.winner_count = 1;
        } else if total == round.best_score {
            round.winner_count = round.winner_count.checked_add(1).unwrap();
        }
        msg!("entry {} scored {}", entry.player, total);
        Ok(())
    }

    /// Pay a winning entry its equal share of the pot (winner-take-all, ties split).
    pub fn payout(ctx: Context<Payout>) -> Result<()> {
        let round = &ctx.accounts.round;
        require!(
            round.scored_count == round.entrants && round.entrants > 0,
            ProofxiError::ScoringIncomplete
        );
        let entry = &mut ctx.accounts.entry;
        require!(entry.scored && !entry.paid, ProofxiError::NotPayable);
        require!(entry.score == round.best_score, ProofxiError::NotAWinner);
        require!(round.winner_count > 0, ProofxiError::ScoringIncomplete);

        let share = round.pot / (round.winner_count as u64);
        let round_id_bytes = round.round_id.to_le_bytes();
        let seeds: &[&[u8]] = &[b"vault_auth", round_id_bytes.as_ref(), &[round.vault_bump]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.winner_ata.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                &[seeds],
            ),
            share,
        )?;

        entry.paid = true;
        let round = &mut ctx.accounts.round;
        round.paid_count = round.paid_count.checked_add(1).unwrap();
        msg!("paid {} to {}", share, entry.player);
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct Faucet<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    /// CHECK: PDA mint authority for the test-USDC mint.
    #[account(seeds = [b"usdc_mint_authority"], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub recipient_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct CreateRound<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Round::INIT_SPACE,
        seeds = [b"round", round_id.to_le_bytes().as_ref()],
        bump
    )]
    pub round: Account<'info, Round>,
    pub usdc_mint: Account<'info, Mint>,
    /// CHECK: PDA that owns the round vault.
    #[account(seeds = [b"vault_auth", round_id.to_le_bytes().as_ref()], bump)]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault_authority,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Enter<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut, seeds = [b"round", round.round_id.to_le_bytes().as_ref()], bump = round.bump)]
    pub round: Account<'info, Round>,
    #[account(
        init,
        payer = player,
        space = 8 + Entry::INIT_SPACE,
        seeds = [b"entry", round.key().as_ref(), player.key().as_ref()],
        bump
    )]
    pub entry: Account<'info, Entry>,
    #[account(mut, constraint = player_ata.mint == round.usdc_mint @ ProofxiError::WrongMint)]
    pub player_ata: Account<'info, TokenAccount>,
    #[account(mut, address = round.vault @ ProofxiError::WrongVault)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    pub settler: Signer<'info>,
    #[account(mut, seeds = [b"round", round.round_id.to_le_bytes().as_ref()], bump = round.bump)]
    pub round: Account<'info, Round>,
    /// CHECK: Txoracle's daily-roots PDA; derived + checked in the handler and
    /// enforced by the CPI's Merkle verification.
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,
    /// CHECK: the Txoracle program; pinned to the known program id.
    #[account(address = TXORACLE @ ProofxiError::WrongTxoracle)]
    pub txoracle_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ScoreEntry<'info> {
    pub scorer: Signer<'info>,
    #[account(mut, seeds = [b"round", round.round_id.to_le_bytes().as_ref()], bump = round.bump)]
    pub round: Account<'info, Round>,
    #[account(
        mut,
        seeds = [b"entry", round.key().as_ref(), entry.player.as_ref()],
        bump = entry.bump,
        has_one = round @ ProofxiError::WrongRound
    )]
    pub entry: Account<'info, Entry>,
}

#[derive(Accounts)]
pub struct Payout<'info> {
    pub caller: Signer<'info>,
    #[account(mut, seeds = [b"round", round.round_id.to_le_bytes().as_ref()], bump = round.bump)]
    pub round: Account<'info, Round>,
    #[account(
        mut,
        seeds = [b"entry", round.key().as_ref(), entry.player.as_ref()],
        bump = entry.bump,
        has_one = round @ ProofxiError::WrongRound
    )]
    pub entry: Account<'info, Entry>,
    #[account(mut, address = round.vault @ ProofxiError::WrongVault)]
    pub vault: Account<'info, TokenAccount>,
    /// CHECK: PDA vault authority; signs the payout transfer.
    #[account(seeds = [b"vault_auth", round.round_id.to_le_bytes().as_ref()], bump = round.vault_bump)]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = winner_ata.owner == entry.player @ ProofxiError::WrongWinnerAta,
        constraint = winner_ata.mint == round.usdc_mint @ ProofxiError::WrongMint
    )]
    pub winner_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct Round {
    pub authority: Pubkey,
    pub round_id: u64,
    pub usdc_mint: Pubkey,
    pub vault: Pubkey,
    pub entry_fee: u64,
    pub lock_time: i64,
    pub entrants: u32,
    pub pot: u64,
    #[max_len(8)]
    pub markets: Vec<MarketDef>,
    pub settled_count: u8,
    pub best_score: u64,
    pub winner_count: u32,
    pub scored_count: u32,
    pub paid_count: u32,
    pub bump: u8,
    pub vault_bump: u8,
}

/// A boolean market proposition resolved by `validate_stat`.
/// e.g. "home wins" = (stat 1002 − stat 1003) > 0.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct MarketDef {
    pub fixture_id: i64,
    pub stat_key_a: u32,
    pub stat_key_b: u32,
    pub use_second: bool,
    /// 0 = Add, 1 = Subtract (only if use_second).
    pub op: u8,
    /// 0 = GreaterThan, 1 = LessThan, 2 = EqualTo.
    pub comparison: u8,
    pub threshold: i32,
    pub settled: bool,
    pub outcome: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Entry {
    pub round: Pubkey,
    pub player: Pubkey,
    pub captain_index: u8,
    pub scored: bool,
    pub paid: bool,
    pub score: u64,
    #[max_len(8)]
    pub picks: Vec<Pick>,
    pub bump: u8,
}

/// A player's prediction on a market plus its odds-weight (points if correct).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct Pick {
    pub prediction: bool,
    pub odds_weight: u32,
}

// ---------------------------------------------------------------------------
// Txoracle passthrough types (borsh layout must match its IDL exactly).
// ---------------------------------------------------------------------------

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: ScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StatTerm {
    pub stat_to_prove: ScoreStat,
    pub event_stat_root: [u8; 32],
    pub stat_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum Comparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum BinaryExpression {
    Add,
    Subtract,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TraderPredicate {
    pub threshold: i32,
    pub comparison: Comparison,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum ProofxiError {
    #[msg("Faucet amount must be > 0 and within the cap")]
    FaucetAmount,
    #[msg("Round must define between 1 and MAX_MARKETS markets")]
    MarketCount,
    #[msg("Malformed market definition")]
    BadMarket,
    #[msg("Round is locked; entries are closed")]
    RoundLocked,
    #[msg("Round is still open; wait for lock time")]
    RoundOpen,
    #[msg("Pick count must match market count")]
    PickCount,
    #[msg("Captain index out of range")]
    BadCaptain,
    #[msg("Market index out of range")]
    BadMarketIndex,
    #[msg("Market already settled")]
    AlreadySettled,
    #[msg("Provided stat key does not match the market")]
    StatMismatch,
    #[msg("Market needs a second stat but none was provided")]
    MissingSecondStat,
    #[msg("Market is single-stat but a second stat was provided")]
    UnexpectedSecondStat,
    #[msg("Daily-roots account does not match the derived Txoracle PDA")]
    WrongDailyRootAccount,
    #[msg("Unexpected Txoracle program")]
    WrongTxoracle,
    #[msg("Txoracle CPI returned no data")]
    NoReturnData,
    #[msg("Not all markets are settled yet")]
    NotAllSettled,
    #[msg("Entry already scored")]
    AlreadyScored,
    #[msg("Scoring is not complete for all entrants")]
    ScoringIncomplete,
    #[msg("Entry is not payable")]
    NotPayable,
    #[msg("Entry is not a winner")]
    NotAWinner,
    #[msg("Wrong mint for this round")]
    WrongMint,
    #[msg("Wrong vault for this round")]
    WrongVault,
    #[msg("Entry does not belong to this round")]
    WrongRound,
    #[msg("Winner ATA owner mismatch")]
    WrongWinnerAta,
}
