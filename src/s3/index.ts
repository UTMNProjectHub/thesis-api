import { S3Client } from "bun";

export const client = new S3Client({
  accessKeyId: process.env.MINIO_ROOT_USER!,
  secretAccessKey: process.env.MINIO_ROOT_PASSWORD!,
  bucket: "quizy",
  endpoint: process.env.MINIO_ENDPOINT! || "http://localhost:9010",
  region: "ru-central1",
});
