import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ConvexHttpClient } from "convex/browser";
import ffmpegPath from "ffmpeg-static";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

const runId = process.argv[2] as Id<"runs"> | undefined;

if (!runId) {
  console.error("Usage: bun scripts/render-approved-run.ts <runId>");
  process.exit(1);
}

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.error("NEXT_PUBLIC_CONVEX_URL is not configured.");
  process.exit(1);
}

if (!ffmpegPath) {
  console.error("ffmpeg-static did not provide an FFmpeg binary.");
  process.exit(1);
}

const convexDeploymentUrl = convexUrl;
const ffmpegBin = ffmpegPath;
const r2 = createR2Uploader();

if (!r2) {
  console.warn(
    "R2 is not configured; export receipts will use local /exports URLs that only work on this machine.",
  );
}

await renderApprovedRun(runId);

async function renderApprovedRun(targetRunId: Id<"runs">) {
  const client = new ConvexHttpClient(convexDeploymentUrl);
  const run = await client.query(api.runs.getRun, { runId: targetRunId });

  if (!run) {
    throw new Error(`Run not found: ${targetRunId}`);
  }

  const video = await client.query(api.runs.getVideo, { videoId: run.videoId });

  if (!video?.publicUrl) {
    throw new Error("Run video does not have a public R2 URL.");
  }

  const candidates = await client.query(api.candidates.listByRun, {
    runId: targetRunId,
  });
  const approved = candidates.filter((clip) => clip.status === "approved");

  if (!approved.length) {
    throw new Error("Approve at least one candidate before rendering.");
  }

  const outputDir = path.join(process.cwd(), "public", "exports", targetRunId);
  await mkdir(outputDir, { recursive: true });

  const exporterStepId = await client.mutation(api.workflow.addStep, {
    runId: targetRunId,
    role: "exporter",
    status: "running",
    order: 4,
    inputSummary: `${approved.length} approved candidate clips.`,
    outputSummary: "Rendering vertical MP4 exports.",
  });

  try {
    await client.mutation(api.receipts.clearByRun, { runId: targetRunId });
    await client.mutation(api.runs.updateRunStatus, {
      runId: targetRunId,
      status: "rendering",
    });

    for (const clip of approved) {
      const start = parseTimestamp(clip.startTime);
      const end = parseTimestamp(clip.endTime);
      const duration = Math.max(1, end - start);
      const filename = `${safeFilename(clip.title)}-${clip._id}.mp4`;
      const outputPath = path.join(outputDir, filename);

      await runFfmpeg([
        "-y",
        "-ss",
        String(start),
        "-i",
        video.publicUrl,
        "-t",
        String(duration),
        "-vf",
        "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        outputPath,
      ]);

      const artifactUrl = r2
        ? await r2.upload(`exports/${targetRunId}/${filename}`, outputPath)
        : `/exports/${targetRunId}/${filename}`;

      await client.mutation(api.receipts.createReceipt, {
        runId: targetRunId,
        clipId: clip._id,
        artifactUrl,
        hook: clip.title,
        caption: clip.reason,
        hashtags: ["#podcast", "#shorts", "#clipcrew"],
      });
    }

    await client.mutation(api.workflow.updateStep, {
      stepId: exporterStepId,
      status: "completed",
      outputSummary: `Rendered ${approved.length} approved MP4 clips.`,
      completedAt: Date.now(),
    });
    await client.mutation(api.runs.updateRunStatus, {
      runId: targetRunId,
      status: "rendered",
      completedAt: Date.now(),
    });

    console.log(`Rendered ${approved.length} clips for ${targetRunId}.`);
  } catch (error) {
    await client.mutation(api.workflow.updateStep, {
      stepId: exporterStepId,
      status: "failed",
      outputSummary:
        error instanceof Error ? error.message : "Approved clip rendering failed.",
      completedAt: Date.now(),
    });
    await client.mutation(api.runs.updateRunStatus, {
      runId: targetRunId,
      status: "failed",
      completedAt: Date.now(),
    });
    throw error;
  }
}

function createR2Uploader() {
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !publicBaseUrl || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const client = new S3Client({
    credentials: { accessKeyId, secretAccessKey },
    endpoint,
    forcePathStyle: true,
    region: "auto",
  });

  return {
    async upload(key: string, filePath: string) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: await readFile(filePath),
          ContentType: "video/mp4",
        }),
      );

      return `${publicBaseUrl.replace(/\/$/, "")}/${key}`;
    },
  };
}

async function runFfmpeg(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegBin, args, { stdio: ["ignore", "ignore", "pipe"] });
    const errors: string[] = [];

    child.stderr.on("data", (chunk: Buffer) => {
      errors.push(String(chunk));
    });
    child.on("error", reject);
    child.on("close", (code: number | null) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(errors.join("").trim() || `FFmpeg exited with ${code}`));
    });
  });
}

function parseTimestamp(timestamp: string) {
  const parts = timestamp.split(":").map(Number);

  if (parts.some((part) => Number.isNaN(part))) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }

  return parts.reduce((total, part) => total * 60 + part, 0);
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "clip";
}
