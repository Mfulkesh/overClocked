import { Router } from "express";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

/**
 * POST /api/auth/privy
 * Called from the frontend after Privy login.
 * Upserts a User record, returns user + org (if any).
 */
authRouter.post("/privy", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const { privyId, walletAddress, email } = req.user!;

        const user = await prisma.user.upsert({
            where: { privyId },
            update: {
                walletAddress: walletAddress ?? undefined,
                email: email ?? undefined,
            },
            create: {
                privyId,
                walletAddress,
                email,
            },
            include: { org: true },
        });

        res.json({ user });
    } catch (err) {
        console.error("[auth/privy]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * GET /api/auth/me
 * Returns current user + org from DB.
 */
authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { privyId: req.user!.privyId },
            include: { org: true },
        });

        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        res.json({ user });
    } catch (err) {
        console.error("[auth/me]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
