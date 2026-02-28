import "dotenv/config";
import cron from "node-cron";
import { prisma } from "../db.js";

// Yield rate BPS per year by policy index (0=None, 1=5%, 2=8%, 3=12%)
const YIELD_RATE_BPS = [0, 500, 800, 1200];

/**
 * Daily yield accrual cron — runs at midnight every day.
 * For each ACTIVE campaign with a yield policy, calculate daily yield
 * on the current raised amount and store in YieldAccrual.
 *
 * Daily yield = (raisedLamports × rateBps) / (10_000 × 365)
 */
async function accrueYield() {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const activeCampaigns = await prisma.campaign.findMany({
            where: {
                state: "ACTIVE",
                yieldPolicy: { gt: 0 },
            },
            select: { id: true, raisedLamports: true, yieldPolicy: true },
        });

        console.log(`[yield-cron] Accruing yield for ${activeCampaigns.length} campaigns`);

        for (const campaign of activeCampaigns) {
            const rateBps = YIELD_RATE_BPS[campaign.yieldPolicy] ?? 0;
            if (rateBps === 0) continue;

            // Daily yield = annual rate / 365
            const dailyYieldLamports =
                (BigInt(campaign.raisedLamports) * BigInt(rateBps)) /
                (BigInt(10_000) * BigInt(365));

            if (dailyYieldLamports === 0n) continue;

            // Avoid duplicate accrual for same day
            const existing = await prisma.yieldAccrual.findFirst({
                where: { campaignId: campaign.id, periodDate: today },
            });

            if (!existing) {
                await prisma.yieldAccrual.create({
                    data: {
                        campaignId: campaign.id,
                        yieldLamports: dailyYieldLamports,
                        periodDate: today,
                        yieldRateBps: rateBps,
                    },
                });

                console.log(
                    `[yield-cron] Campaign ${campaign.id}: +${dailyYieldLamports} lamports (${rateBps}bps)`
                );
            }
        }
    } catch (err) {
        console.error("[yield-cron] Error:", err);
    }
}

/**
 * Start the yield cron job. Called once at server startup.
 * Runs every day at 00:01 UTC.
 */
export function startYieldCron() {
    cron.schedule("1 0 * * *", accrueYield, { timezone: "UTC" });
    console.log("🌱 Yield cron started (daily at 00:01 UTC)");
}

// Export for manual trigger (e.g., testing)
export { accrueYield };
