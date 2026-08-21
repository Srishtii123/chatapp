import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env.S3_ENDPOINT;
const bucket = process.env.S3_BUCKET || "";
const client = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: process.env.S3_ACCESS_KEY_ID ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "" } : undefined,
});

export async function uploadSupportAttachmentToS3(buffer: Buffer, key: string, contentType: string): Promise<string> {
  if (!bucket) throw new Error("S3_BUCKET is not configured");
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType || "application/octet-stream" }));
  const publicBase = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
  if (publicBase) return `${publicBase}/${key}`;
  if (!endpoint) throw new Error("S3_PUBLIC_URL is required when no public endpoint is configured");
  return `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
}
