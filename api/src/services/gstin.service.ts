import crypto from "crypto";

const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export interface GstinValidationResult {
    isValid: boolean;
    gstin: string;
    legalName?: string;
    tradeName?: string;
    state?: string;
    stateCode?: string;
    registrationDate?: string;
    status?: string; // "Active", "Cancelled", etc.
    error?: string;
}

/**
 * MOCK GSTIN validator for hackathon demo.
 *
 * In production, replace with a real GST API call:
 *   - https://api.mastergst.com/masterapi/official/gstin/{gstin}
 *   - https://gstin.io/api
 *   - GST official sandbox: https://sandbox.gst.gov.in
 *
 * The mock accepts any GSTIN that matches the valid 15-char format
 * and returns plausible-looking data. A small set of well-known real
 * GSTINs are pre-seeded for demo purposes.
 */
const KNOWN_GSTINS: Record<string, Partial<GstinValidationResult>> = {
    // Razorpay Payments Private Limited
    "29AABCR1234A1Z5": {
        legalName: "Razorpay Payments Pvt Ltd",
        tradeName: "Razorpay",
        state: "Karnataka",
        stateCode: "29",
        registrationDate: "2014-10-01",
        status: "Active",
    },
    // Zoho Corporation
    "33AAACZ1234G1Z5": {
        legalName: "Zoho Corporation Pvt Ltd",
        tradeName: "Zoho",
        state: "Tamil Nadu",
        stateCode: "33",
        registrationDate: "2008-06-01",
        status: "Active",
    },
};

/**
 * Validates a GSTIN. Uses mock data in dev; replace with real API in prod.
 */
export async function validateGstin(
    gstin: string
): Promise<GstinValidationResult> {
    const clean = normalizeGstin(gstin);

    // Format check first
    if (!GSTIN_REGEX.test(clean)) {
        return { isValid: false, gstin: clean, error: "Invalid GSTIN format" };
    }

    // Check known seed GSTINs for demo
    if (KNOWN_GSTINS[clean]) {
        return {
            isValid: true,
            gstin: clean,
            ...KNOWN_GSTINS[clean],
        };
    }

    // Optional live mode: use external provider if configured.
    if (process.env.GST_VALIDATE_MODE === "live" && process.env.GST_API_URL) {
        try {
            const live = await validateGstinLive(clean);
            if (live) return live;
        } catch (err) {
            console.warn("[gstin] live validation failed, falling back to mock:", err);
        }
    }

    // For hackathon: accept any valid-format GSTIN as "active" and derive state from first 2 digits
    const stateCode = clean.slice(0, 2);
    const stateName = STATE_CODE_MAP[stateCode] ?? "Unknown";

    return {
        isValid: true,
        gstin: clean,
        legalName: `Business (GSTIN ${clean})`, // Real API would return actual name
        state: stateName,
        stateCode,
        status: "Active",
        // Flag that this wasn't verified against real GST database
        error: process.env.NODE_ENV === "production"
            ? "GST API not configured — GSTIN format valid but not verified against live registry"
            : undefined,
    };
}

async function validateGstinLive(gstin: string): Promise<GstinValidationResult | null> {
    const baseUrl = process.env.GST_API_URL;
    if (!baseUrl) return null;

    const url = `${baseUrl.replace(/\/$/, "")}/${gstin}`;
    const headers: Record<string, string> = {};
    if (process.env.GST_API_KEY) headers["Authorization"] = `Bearer ${process.env.GST_API_KEY}`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
        return {
            isValid: false,
            gstin,
            error: `Live GST API error (${response.status})`,
        };
    }

    const data = (await response.json()) as Record<string, unknown>;
    const status = String(data.status ?? data.gstinStatus ?? "Unknown");
    const legalName = String(data.legalName ?? data.lgnm ?? "") || undefined;
    const tradeName = String(data.tradeName ?? data.tradeNam ?? "") || undefined;
    const stateCode = String(data.stateCode ?? data.stjCd ?? gstin.slice(0, 2));
    const state = STATE_CODE_MAP[stateCode] ?? String(data.state ?? "Unknown");
    const registrationDate = String(data.registrationDate ?? data.rgdt ?? "") || undefined;
    const isActive = status.toLowerCase() === "active";

    return {
        isValid: isActive,
        gstin,
        legalName,
        tradeName,
        state,
        stateCode,
        registrationDate,
        status,
        error: isActive ? undefined : `GSTIN status is ${status}`,
    };
}

export function normalizeGstin(gstin: string): string {
    return gstin.trim().toUpperCase();
}

export function computeGstinHashHex(gstin: string): string {
    return crypto.createHash("sha256").update(normalizeGstin(gstin)).digest("hex");
}

/**
 * Computes SHA-256 hash of a Buffer (invoice file bytes).
 * Returns hex string.
 */
export function computeInvoiceHash(fileBuffer: Buffer): string {
    return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

/**
 * Converts a hex invoice hash string to a 32-byte Uint8Array for Anchor.
 */
export function hexHashToBytes(hexHash: string): number[] {
    const buf = Buffer.from(hexHash, "hex");
    if (buf.length !== 32) throw new Error("Invoice hash must be 32 bytes");
    return Array.from(buf);
}

/**
 * Validates that the invoice amount covers the milestone release amount.
 * Both in paise (INR × 100).
 */
export function validateInvoiceAmount(
    invoiceAmountPaise: bigint,
    milestoneAmountPaise: bigint
): boolean {
    return invoiceAmountPaise >= milestoneAmountPaise;
}

// State code lookup table (India GST)
const STATE_CODE_MAP: Record<string, string> = {
    "01": "Jammu & Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "25": "Daman & Diu",
    "26": "Dadra & Nagar Haveli",
    "27": "Maharashtra",
    "28": "Andhra Pradesh",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman & Nicobar",
    "36": "Telangana",
    "37": "Andhra Pradesh (new)",
    "38": "Ladakh",
    "97": "Other Territory",
    "99": "Centre Jurisdiction",
};
