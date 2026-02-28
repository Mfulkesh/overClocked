import type { Request, Response, NextFunction } from "express";

// Lightweight Privy JWT verification
// In production, use the official @privy-io/server-auth SDK
// For the hackathon, we verify via the Privy API endpoint

export interface AuthedRequest extends Request {
    user?: {
        privyId: string;
        walletAddress?: string;
        email?: string;
    };
}

export async function requireAuth(
    req: AuthedRequest,
    res: Response,
    next: NextFunction
) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing authorization header" });
        return;
    }

    const token = authHeader.slice(7);

    try {
        // Verify the Privy JWT via their verification endpoint
        const resp = await fetch("https://auth.privy.io/api/v1/identity/token", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "privy-app-id": process.env.PRIVY_APP_ID!,
            },
        });

        if (!resp.ok) {
            res.status(401).json({ error: "Invalid token" });
            return;
        }

        const data = (await resp.json()) as {
            user: { id: string; wallet?: { address: string }; email?: { address: string } };
        };

        req.user = {
            privyId: data.user.id,
            walletAddress: data.user.wallet?.address,
            email: data.user.email?.address,
        };

        next();
    } catch {
        res.status(401).json({ error: "Token verification failed" });
    }
}
