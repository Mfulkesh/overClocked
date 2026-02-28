use anchor_lang::prelude::*;

#[account]
pub struct OrgAccount {
    pub authority: Pubkey,
    /// SHA-256 hash of the org's verified GSTIN (uppercase, trimmed).
    pub gstin_hash: [u8; 32],
    pub campaigns_created: u32,
    pub campaigns_completed: u32,
    pub campaigns_failed: u32,
    pub total_raised_lamports: u64,
    pub total_released_lamports: u64,
    pub completion_rate_bps: u16,
    pub bump: u8,
}

impl OrgAccount {
    // 8 + 32 + 32 + 4 + 4 + 4 + 8 + 8 + 2 + 1 = 103
    pub const SPACE: usize = 8 + 32 + 32 + 4 + 4 + 4 + 8 + 8 + 2 + 1;
}
