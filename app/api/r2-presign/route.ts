import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const maxUploadBytes = 2 * 1024 * 1024 * 1024;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const filename = typeof body?.filename === "string" ? body.filename : "";
  const contentType =
    typeof body?.contentType === "string" ? body.contentType : "";
  const size = typeof body?.size === "number" ? body.size : 0;

  if (!filename || filename.length > 180) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  if (!contentType.startsWith("video/")) {
    return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
  }

  if (!Number.isFinite(size) || size <= 0 || size > maxUploadBytes) {
    return NextResponse.json({ error: "Invalid file size" }, { status: 400 });
  }

  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !publicBaseUrl || !accessKeyId || !secretAccessKey) {
    return NextResponse.json({ error: "R2 is not configured" }, { status: 503 });
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const key = `uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeFilename}`;
  const client = new S3Client({
    credentials: { accessKeyId, secretAccessKey },
    endpoint,
    forcePathStyle: true,
    region: "auto",
  });

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentLength: size,
      ContentType: contentType,
    }),
    { expiresIn: 60 * 10 },
  );

  return NextResponse.json({
    uploadUrl,
    key,
    publicUrl: `${publicBaseUrl.replace(/\/$/, "")}/${key}`,
  });
}
