import { createWriteStream, createReadStream } from "node:fs";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { ConvexHttpClient } from "convex/browser";
import Groq from "groq-sdk";
import ffmpegPath from "ffmpeg-static";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

const segmentSeconds = 10 * 60;

type GroqVerboseTranscription = {
  text: string;
  words?: Array<Record<string, unknown>>;
  segments?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

const runId = process.argv[2] as Id<"runs"> | undefined;

if (!runId) {
  console.error("Usage: bun scripts/transcribe-run.ts <runId>");
  process.exit(1);
}

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.error("NEXT_PUBLIC_CONVEX_URL is not configured.");
  process.exit(1);
}

const convexDeploymentUrl = convexUrl;
const groqApiKey = process.env.GROQ_API_KEY || convexEnv("GROQ_API_KEY");

if (!groqApiKey) {
  console.error("GROQ_API_KEY is not configured locally or in Convex env.");
  process.exit(1);
}

if (!ffmpegPath) {
  console.error("ffmpeg-static did not provide an FFmpeg binary.");
  process.exit(1);
}

const ffmpegBin = ffmpegPath;

await transcribeRun(runId);

async function transcribeRun(targetRunId: Id<"runs">) {
  const client = new ConvexHttpClient(convexDeploymentUrl);
  const groq = new Groq({ apiKey: groqApiKey });
  const run = await client.query(api.runs.getRun, { runId: targetRunId });

  if (!run) {
    throw new Error(`Run not found: ${targetRunId}`);
  }

  const video = await client.query(api.runs.getVideo, { videoId: run.videoId });

  if (!video?.publicUrl) {
    throw new Error("Run video does not have a public R2 URL.");
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "clipcrew-transcribe-"));
  let transcriberStepId: Id<"workflowSteps"> | null = null;

  try {
    await client.mutation(api.workflow.clearByRun, { runId: targetRunId });
    await client.mutation(api.runs.updateRunStatus, {
      runId: targetRunId,
      status: "running",
    });
    await client.mutation(api.workflow.addStep, {
      runId: targetRunId,
      role: "producer",
      status: "completed",
      order: 1,
      inputSummary: `${run.title} - ${video.publicUrl}`,
      outputSummary: "Validated R2 video metadata and created a chunked transcription job.",
    });
    transcriberStepId = await client.mutation(api.workflow.addStep, {
      runId: targetRunId,
      role: "transcriber",
      status: "running",
      order: 2,
      inputSummary: "Chunked Groq Whisper transcription from uploaded R2 media.",
      outputSummary: "Downloading video and splitting audio.",
    });

    const inputPath = path.join(workDir, safeFilename(video.fileName));
    await download(video.publicUrl, inputPath);

    const chunkDir = path.join(workDir, "chunks");
    await mkdir(chunkDir);
    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "32k",
      "-f",
      "segment",
      "-segment_time",
      String(segmentSeconds),
      "-reset_timestamps",
      "1",
      path.join(chunkDir, "chunk-%03d.mp3"),
    ]);

    const chunkFiles = (await readdir(chunkDir))
      .filter((file) => file.endsWith(".mp3"))
      .sort();

    if (!chunkFiles.length) {
      throw new Error("FFmpeg did not produce audio chunks.");
    }

    const chunks = [];
    const texts = [];

    for (const [index, fileName] of chunkFiles.entries()) {
      const offsetSeconds = index * segmentSeconds;
      const filePath = path.join(chunkDir, fileName);
      const transcription = (await groq.audio.transcriptions.create({
        file: createReadStream(filePath),
        model: "whisper-large-v3",
        response_format: "verbose_json",
        timestamp_granularities: ["word"],
      })) as GroqVerboseTranscription;
      const adjusted = adjustTimestamps(transcription, offsetSeconds);

      texts.push(adjusted.text);
      chunks.push({
        chunkIndex: index,
        text: adjusted.text,
        payload: adjusted,
      });
    }

    const sourceText = texts.join("\n").trim();

    if (!sourceText) {
      throw new Error("Groq returned an empty transcript.");
    }

    await client.mutation(api.runs.updateRunTranscript, {
      runId: targetRunId,
      sourceText,
      sourceType: "groq_transcript",
      chunks,
    });
    await client.mutation(api.workflow.updateStep, {
      stepId: transcriberStepId,
      status: "completed",
      outputSummary: `Prepared Groq transcript from ${chunkFiles.length} audio chunks.`,
      completedAt: Date.now(),
    });
    await client.mutation(api.runs.updateRunStatus, {
      runId: targetRunId,
      status: "transcribed",
    });

    console.log(`Transcribed ${targetRunId} from ${chunkFiles.length} chunks.`);
  } catch (error) {
    const outputSummary =
      error instanceof Error ? error.message : "Chunked transcription failed.";

    if (transcriberStepId) {
      await client.mutation(api.workflow.updateStep, {
        stepId: transcriberStepId,
        status: "failed",
        outputSummary,
        completedAt: Date.now(),
      });
    }

    await client.mutation(api.runs.updateRunStatus, {
      runId: targetRunId,
      status: "failed",
      completedAt: Date.now(),
    });
    throw error;
  } finally {
    await rm(workDir, { force: true, recursive: true });
  }
}

async function download(url: string, outputPath: string) {
  const response = await fetch(url);

  if (!response.ok || !response.body) {
    throw new Error(`Could not download media: ${response.status}`);
  }

  await pipeline(
    Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
    createWriteStream(outputPath),
  );
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

function adjustTimestamps(
  transcription: GroqVerboseTranscription,
  offsetSeconds: number,
) {
  return {
    ...transcription,
    words: transcription.words?.map((word) => adjustTimedItem(word, offsetSeconds)),
    segments: transcription.segments?.map((segment) =>
      adjustTimedItem(segment, offsetSeconds),
    ),
  };
}

function adjustTimedItem<T extends Record<string, unknown>>(
  item: T,
  offsetSeconds: number,
) {
  return {
    ...item,
    start:
      typeof item.start === "number" ? item.start + offsetSeconds : item.start,
    end: typeof item.end === "number" ? item.end + offsetSeconds : item.end,
  };
}

function safeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "-") || "media";
}

function convexEnv(name: string) {
  const result = spawnSync("bunx", ["convex", "env", "get", name], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  return result.status === 0 ? result.stdout.trim() : "";
}
