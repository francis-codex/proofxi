use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::{get_return_data, invoke},
};

declare_id!("FLfi8rshUqV8cn71Z1nj29bFLmDdAhiHsVBoqLvhia1F");

/// ProofXI — Phase 1 de-risk.
///
/// The whole trustless thesis hinges on one question: can an on-chain program
/// CPI into `Txoracle.validate_stat`, and *read back the boolean it returns*, so
/// that a settlement program can gate a USDC payout on a cryptographically
/// verified match outcome — no admin, no trusted oracle?
///
/// This program answers it in the most minimal way possible. It takes a fully
/// pre-serialized `validate_stat` instruction (built client-side from the real
/// TxLINE Merkle proof, so this program needs zero knowledge of Txoracle's
/// nested proof types), forwards it via CPI, reads the return data, decodes the
/// bool, logs it, and records it in an account for anyone to inspect.
#[program]
pub mod proof_verifier {
    use super::*;

    pub fn verify_proof(ctx: Context<VerifyProof>, ix_data: Vec<u8>) -> Result<()> {
        let txoracle = ctx.accounts.txoracle_program.key();
        let daily = ctx.accounts.daily_scores_merkle_roots.key();

        // Rebuild the exact instruction the client serialized. `validate_stat`
        // takes a single account: the daily scores Merkle-roots PDA.
        let ix = Instruction {
            program_id: txoracle,
            accounts: vec![AccountMeta::new_readonly(daily, false)],
            data: ix_data,
        };

        invoke(
            &ix,
            &[
                ctx.accounts.daily_scores_merkle_roots.to_account_info(),
                ctx.accounts.txoracle_program.to_account_info(),
            ],
        )?;

        // The moment of truth: read the bool Txoracle set via set_return_data.
        let (returning_program, data) =
            get_return_data().ok_or_else(|| error!(VerifyError::NoReturnData))?;
        require_keys_eq!(returning_program, txoracle, VerifyError::WrongReturnProgram);

        let outcome = match data.first() {
            Some(&b) => b != 0,
            None => return err!(VerifyError::EmptyReturnData),
        };

        msg!("validate_stat CPI return bytes: {:?}", data);
        msg!("validate_stat outcome (bool): {}", outcome);

        let result = &mut ctx.accounts.result;
        result.outcome = outcome;
        result.checked_at = Clock::get()?.unix_timestamp;
        result.txoracle = txoracle;
        result.daily_scores = daily;
        result.bump = ctx.bumps.result;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct VerifyProof<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + ProofResult::SPACE,
        seeds = [b"proof_result", payer.key().as_ref()],
        bump
    )]
    pub result: Account<'info, ProofResult>,

    /// CHECK: Txoracle's daily-scores Merkle-roots PDA. Its authenticity is
    /// enforced by `validate_stat` itself during the CPI (the Merkle proof must
    /// chain to the root stored in this exact account).
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,

    /// CHECK: the Txoracle program we CPI into; pinned client-side to the known
    /// devnet program id and cross-checked against the return-data author.
    pub txoracle_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct ProofResult {
    /// Whether `validate_stat` confirmed the predicate held against the proof.
    pub outcome: bool,
    /// Unix seconds when this was recorded on-chain.
    pub checked_at: i64,
    /// The Txoracle program that produced the verdict.
    pub txoracle: Pubkey,
    /// The daily-scores root PDA the proof was checked against.
    pub daily_scores: Pubkey,
    pub bump: u8,
}

impl ProofResult {
    // bool + i64 + Pubkey + Pubkey + u8
    pub const SPACE: usize = 1 + 8 + 32 + 32 + 1;
}

#[error_code]
pub enum VerifyError {
    #[msg("Txoracle CPI produced no return data")]
    NoReturnData,
    #[msg("Return data came from an unexpected program")]
    WrongReturnProgram,
    #[msg("Return data was empty")]
    EmptyReturnData,
}
