import { Router } from "express";
import { prisma } from "../db.js";

export const webhookRouter = Router();

/**
 * POST /api/webhook/helius
 * Helius Enhanced Webhook — syncs on-chain events to DB.
 *
 * Configure in Helius dashboard:
 *   URL: https://your-api.com/api/webhook/helius
 *   Program: G5WtbViVihHkgX9FrxZYup7qRKLudyzzNpiE96xMVZ8a
 *   Transaction types: ANY
 */
webhookRouter.post("/helius", async (req, res) => {
    try {
        const events: any[] = Array.isArray(req.body) ? req.body : [req.body];

        for (const event of events) {
            const signature: string = event.signature ?? event.transactionId ?? "";
            const logs: string[] = event.meta?.logMessages ?? event.logs ?? [];

            // ── Detect instruction type from logs ──────────────────────────────────
            const isInstruction = (name: string) =>
                logs.some((l: string) => l.includes(`Instruction: ${name}`));

            // ── Donate ─────────────────────────────────────────────────────────────
            if (isInstruction("Donate")) {
                const accountKeys: string[] = event.transaction?.message?.accountKeys ?? [];
                const vaultPda = accountKeys[3]; // index depends on ix order — adjust per IDL
                const donorWallet = accountKeys[0];
                const amount = event.meta?.postBalances?.[3] - event.meta?.preBalances?.[3];

                if (vaultPda && amount > 0) {
                    const campaign = await prisma.campaign.findFirst({
                        where: { onchainVaultPda: vaultPda },
                    });

                    if (campaign) {
                        // Upsert donation by txSignature (avoid duplicates)
                        await prisma.donation.upsert({
                            where: { txSignature: signature },
                            update: {},
                            create: {
                                campaignId: campaign.id,
                                donorWallet,
                                amountLamports: BigInt(amount),
                                paymentType: "SOL",
                                txSignature: signature,
                                confirmed: true,
                            },
                        });

                        await prisma.campaign.update({
                            where: { id: campaign.id },
                            data: { raisedLamports: { increment: BigInt(amount) } },
                        });

                        console.log(`[helius] Donate: ${amount} lamports → campaign ${campaign.id}`);
                    }
                }
            }

            // ── FinalizeMilestone (Approved) ───────────────────────────────────────
            if (isInstruction("FinalizeMilestone")) {
                // Check if project completed (no more milestones)
                // Update campaign + milestone state in DB
                const vaultPda: string | undefined = event.transaction?.message?.accountKeys
                    ?.find((_: string, i: number) =>
                        event.meta?.logMessages?.some((l: string) => l.includes("vault"))
                    );
                // We rely on campaign state being set by a separate project-state sync
                // (Full parse would require anchor IDL decoding — simplified here)
                console.log(`[helius] FinalizeMilestone: tx ${signature}`);
            }

            // ── Platform override / freeze ─────────────────────────────────────────
            if (isInstruction("PlatformOverride")) {
                console.log(`[helius] PlatformOverride: tx ${signature}`);
            }
        }

        res.json({ ok: true, processed: events.length });
    } catch (err) {
        console.error("[webhook/helius]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /api/webhook/sync-campaign/:id
 * Manual trigger to re-sync a campaign's state from DB (frontend can call after on-chain tx).
 */
webhookRouter.post("/sync-campaign/:id", async (req, res) => {
    try {
        const { state, raisedLamports, currentMilestone } = req.body;

        const updated = await prisma.campaign.update({
            where: { id: req.params.id },
            data: {
                state: state ?? undefined,
                raisedLamports: raisedLamports ? BigInt(raisedLamports) : undefined,
            },
        });

        // Update milestone state if provided
        if (currentMilestone !== undefined) {
            await prisma.milestone.updateMany({
                where: { campaignId: req.params.id, index: currentMilestone },
                data: { state: "APPROVED" },
            });
        }

        res.json({ ok: true, campaign: { ...updated, raisedLamports: updated.raisedLamports.toString(), totalGoalLamports: updated.totalGoalLamports.toString(), prefrontLamports: updated.prefrontLamports.toString() } });
    } catch (err) {
        console.error("[webhook/sync-campaign]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
