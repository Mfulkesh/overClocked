use anchor_lang::prelude::*;
use crate::{
    constants::*,
    error::CredenceError,
    state::{MilestoneState, OrgAccount, Project, ProjectState},
};

/// Voting window bounds (seconds)
const MIN_VOTING_WINDOW_SECS: i64 = 172_800; // 48 hours minimum
const MAX_VOTING_WINDOW_SECS: i64 = 604_800; // 7 days maximum

#[derive(Accounts)]
pub struct SubmitMilestoneProof<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        // Seeds use the STORED project.creator so strangers can't cause account-not-found.
        // The actual authority check is done inside the handler.
        seeds = [PROJECT_SEED, project.creator.as_ref(), &project.project_id],
        bump = project.bump,
    )]
    pub project: Account<'info, Project>,

    #[account(
        seeds = [ORG_SEED, project.creator.as_ref()],
        bump = org.bump,
    )]
    pub org: Account<'info, OrgAccount>,
}

pub fn handler(
    ctx: Context<SubmitMilestoneProof>,
    milestone_index: u8,
    proof_uri: String,
    invoice_hash: [u8; 32],
    vendor_gstin_hash: [u8; 32],
    voting_window_secs: i64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let project = &mut ctx.accounts.project;

    // Runtime authority check — seeds use project.creator so account is always found,
    // but only the actual creator wallet may submit proof.
    require!(
        ctx.accounts.creator.key() == project.creator,
        CredenceError::NotCreator
    );

    require!(
        project.state == ProjectState::Active,
        CredenceError::ProjectNotActive
    );
    require!(
        (milestone_index as usize) < project.milestones.len(),
        CredenceError::MilestoneIndexOutOfRange
    );
    require!(
        proof_uri.len() <= MAX_PROOF_URI_LEN,
        CredenceError::InvalidProofUri
    );

    // Registered vendor path must use the org's GSTIN hash.
    // Unregistered vendor path passes [0u8; 32].
    if vendor_gstin_hash != [0u8; 32] {
        require!(
            vendor_gstin_hash == ctx.accounts.org.gstin_hash,
            CredenceError::OrgGstinMismatch
        );
    }

    let milestone = &project.milestones[milestone_index as usize];

    // Allow resubmission if Rejected, first submission if Pending
    require!(
        milestone.state == MilestoneState::Pending
            || milestone.state == MilestoneState::Rejected,
        CredenceError::MilestoneNotPending
    );
    require!(
        milestone.revision_count < MAX_RESUBMISSIONS,
        CredenceError::MaxResubmissionsReached
    );

    // Clamp voting window to [48h, 7d]
    let window = voting_window_secs
        .max(MIN_VOTING_WINDOW_SECS)
        .min(MAX_VOTING_WINDOW_SECS);

    // Snapshot raised for stake-weighted voting
    let total_eligible = project.raised;

    let m = &mut project.milestones[milestone_index as usize];
    m.proof_uri      = proof_uri;
    m.invoice_hash   = invoice_hash;
    m.state          = MilestoneState::UnderReview;
    m.total_eligible = total_eligible;
    m.voting_start   = now;
    m.voting_end     = now
        .checked_add(window)
        .ok_or(CredenceError::ArithmeticOverflow)?;
    m.vote_yes       = 0;
    m.vote_no        = 0;

    Ok(())
}
