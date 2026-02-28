import { Router } from "express";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { getPresignedUploadUrl } from "../services/s3.js";

export const orgsRouter = Router();

/**
 * POST /api/orgs
 * Register an org after `create_org` is confirmed on-chain.
 */
orgsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { privyId: req.user!.privyId } });
        if (!user) { res.status(404).json({ error: "User not found" }); return; }

        const { name, description, category, websiteUrl, twitterHandle, onchainPda } = req.body;

        const org = await prisma.org.create({
            data: {
                userId: user.id,
                name,
                description,
                category: category ?? "OTHER",
                websiteUrl,
                twitterHandle,
                onchainPda,
            },
        });

        res.status(201).json({ org });
    } catch (err: any) {
        if (err.code === "P2002") { res.status(409).json({ error: "Org already exists for this user" }); return; }
        console.error("[orgs/create]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * GET /api/orgs/:walletAddress
 * Fetch org by wallet address + all campaigns summary.
 */
orgsRouter.get("/:walletAddress", async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { walletAddress: req.params.walletAddress },
            include: {
                org: {
                    include: {
                        campaigns: {
                            select: {
                                id: true,
                                title: true,
                                state: true,
                                raisedLamports: true,
                                totalGoalLamports: true,
                                createdAt: true,
                            },
                            orderBy: { createdAt: "desc" },
                        },
                    },
                },
            },
        });

        if (!user?.org) { res.status(404).json({ error: "Org not found" }); return; }
        res.json({ org: user.org });
    } catch (err) {
        console.error("[orgs/get]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /api/orgs/:id/upload-doc
 * Returns a presigned S3 URL for uploading a verification document.
 */
orgsRouter.post("/:id/upload-doc", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const { fileName, contentType } = req.body;
        if (!fileName || !contentType) { res.status(400).json({ error: "fileName and contentType required" }); return; }

        const key = `orgs/${req.params.id}/docs/${Date.now()}-${fileName}`;
        const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType);

        // Save the doc URL to the org
        await prisma.org.update({
            where: { id: req.params.id as string},
            data: { docUrls: { push: publicUrl } },
        });

        res.json({ uploadUrl, publicUrl });
    } catch (err) {
        console.error("[orgs/upload-doc]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * PATCH /api/orgs/:id/logo
 * Returns presigned URL for org logo upload.
 */
orgsRouter.patch("/:id/logo", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const { fileName, contentType } = req.body;
        const key = `orgs/${req.params.id}/logo/${fileName}`;
        const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType);

        await prisma.org.update({
            where: { id: req.params.id as string },
            data: { logoUrl: publicUrl },
        });

        res.json({ uploadUrl, publicUrl });
    } catch (err) {
        console.error("[orgs/logo]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
