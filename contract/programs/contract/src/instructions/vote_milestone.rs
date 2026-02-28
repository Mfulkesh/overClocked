use anchor_lang::prelude::*;
use crate::{
    constants::*,
    error::CredenceError,
    state::{DonorRecord, Project, MilestoneState, ProjectState},
};

#[derive(Accounts)]
pub struct VoteMilestone<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        mut,
        seeds = [PROJECT_SEED, project.creator.as_ref(), &project.project_id],
        bump = project.bump,
    )]
    pub project: Account<'info, Project>,

    #[account(
        mut,
        seeds = [DONOR_RECORD_SEED, project.key().as_ref(), voter.key().as_ref()],
        bump = donor_record.bump,
        constraint = donor_record.donor == voter.key() @ CredenceError::NoDonorRecord,
    )]
    pub donor_record: Account<'info, DonorRecord>,
}

pub fn handler(
    ctx: Context<VoteMilestone>,
    milestone_index: u8,
    approve: bool,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    require!(
        ctx.accounts.project.state == ProjectState::Active,
        CredenceError::ProjectNotActive
    );
    require!(
        (milestone_index as usize) < ctx.accounts.project.milestones.len(),
        CredenceError::MilestoneIndexOutOfRange
    );

    let (bit, vote_weight) = {
        let milestone = &ctx.accounts.project.milestones[milestone_index as usize];
        require!(
            milestone.state == MilestoneState::UnderReview,
            CredenceError::MilestoneNotUnderReview
        );
        require!(now >= milestone.voting_start, CredenceError::VotingNotOpen);
        require!(now <= milestone.voting_end, CredenceError::VotingWindowNotExpired);

        // Bitmap key is milestone index + revision offset, so a donor may vote again
        // on a resubmitted milestone but not twice in the same review round.
        let bit_index = (milestone_index as u64)
            .checked_add(
                (milestone.revision_count as u64)
                    .checked_mul(MAX_MILESTONES as u64)
                    .ok_or(CredenceError::ArithmeticOverflow)?,
            )
            .ok_or(CredenceError::ArithmeticOverflow)?;
        require!(bit_index < 64, CredenceError::ArithmeticOverflow);
        (1u64 << bit_index, ctx.accounts.donor_record.amount_lamports)
    };

    // Check not already voted for this milestone revision
    require!(
        ctx.accounts.donor_record.voted_bitmap & bit == 0,
        CredenceError::AlreadyVoted
    );

    // Apply vote
    let m = &mut ctx.accounts.project.milestones[milestone_index as usize];
    if approve {
        m.vote_yes = m
            .vote_yes
            .checked_add(vote_weight)
            .ok_or(CredenceError::ArithmeticOverflow)?;
    } else {
        m.vote_no = m
            .vote_no
            .checked_add(vote_weight)
            .ok_or(CredenceError::ArithmeticOverflow)?;
    }

    // Mark bit in bitmap
    ctx.accounts.donor_record.voted_bitmap |= bit;

    Ok(())
}
