import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";

dotenv.config();

const b2Client = new S3Client({
  region: process.env.B2_REGION || "us-west-004",
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  credentials: {
    accessKeyId: process.env.B2_APPLICATION_KEY_ID || "",
    secretAccessKey: process.env.B2_APPLICATION_KEY || "",
  },
});

export async function uploadToStorage(file: Buffer, fileName: string, mimeType: string) {
  const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME,
    Key: fileName,
    Body: file,
    ContentType: mimeType,
  });

  await b2Client.send(command);
  return fileName;
}

export async function getSignedStreamUrl(fileName: string) {
  const command = new GetObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME,
    Key: fileName,
  });

  // URL expires in 48 hours as requested
  return await getSignedUrl(b2Client, command, { expiresIn: 48 * 3600 });
}
