import "dotenv/config";
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
    region: process.env.AWS_REGION ?? "sgp1",
    endpoint: process.env.AWS_ENDPOINT, // e.g. https://sgp1.digitaloceanspaces.com
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY!,
        secretAccessKey: process.env.AWS_SECRET_KEY!,
    },
});

const BUCKET = process.env.AWS_S3_BUCKET ?? "dareme-s3";

/**
 * Generate a 15-minute presigned PUT URL for direct browser uploads.
 * Returns the upload URL and the resulting public URL.
 */
export async function getPresignedUploadUrl(
    key: string,
    contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType,
        ACL: "public-read",
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 min

    // Public URL — DigitalOcean Spaces CDN pattern
    const endpoint = process.env.AWS_ENDPOINT ?? `https://${BUCKET}.${process.env.AWS_REGION ?? "sgp1"}.digitaloceanspaces.com`;
    const publicUrl = `${endpoint}/${key}`;

    return { uploadUrl, publicUrl };
}

/**
 * Generate a presigned GET URL for private files (e.g. verification docs).
 * Default 1-hour expiry.
 */
export async function getPresignedDownloadUrl(
    key: string,
    expiresIn = 3600
): Promise<string> {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(s3, command, { expiresIn });
}
