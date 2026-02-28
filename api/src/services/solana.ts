import "dotenv/config";
import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

const connection = new Connection(
    process.env.SOLANA_RPC ?? "https://api.devnet.solana.com",
    "confirmed"
);

// Hot wallet — funded with SOL to bridge UPI payments
function getHotWallet(): Keypair {
    const secret = process.env.HOT_WALLET_SECRET;
    if (!secret) throw new Error("HOT_WALLET_SECRET not set in .env");
    return Keypair.fromSecretKey(bs58.decode(secret));
}

/**
 * Send SOL from the hot wallet to an on-chain vault PDA.
 * Used after a UPI donation is confirmed by Razorpay.
 */
export async function sendSolFromHotWallet(
    vaultPdaAddress: string,
    lamports: number
): Promise<string> {
    const hotWallet = getHotWallet();
    const toPubkey = new PublicKey(vaultPdaAddress);

    const tx = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: hotWallet.publicKey,
            toPubkey,
            lamports,
        })
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [hotWallet]);
    return signature;
}

/**
 * Get the current lamport balance of a vault PDA.
 */
export async function getVaultBalance(vaultPdaAddress: string): Promise<number> {
    const pubkey = new PublicKey(vaultPdaAddress);
    return connection.getBalance(pubkey);
}

/**
 * Get the hot wallet's current balance (for monitoring).
 */
export async function getHotWalletBalance(): Promise<number> {
    const hotWallet = getHotWallet();
    return connection.getBalance(hotWallet.publicKey);
}
