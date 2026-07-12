"use node";

import Groq from "groq-sdk";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

const transcribableExtensions = new Set([
  "m4a",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "ogg",
  "wav",
  "webm",
]);
const wordChunkSize = 500;
const groqMaxDirectBytes = 25 * 1024 * 1024;

type GroqVerboseTranscription = {
  text: string;
  words?: unknown[];
  segments?: unknown[];
  [key: string]: unknown;
};

export const runClipCrew = action({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    const run = await ctx.runQuery(api.runs.getRun, { runId: args.runId });

    if (!run) {
      return;
    }

    await ctx.runMutation(api.runs.updateRunStatus, {
      runId: args.runId,
      status: "running",
    });

    let transcriberStepId: Id<"workflowSteps"> | null = null;

    try {
      const video = run.videoId
        ? await ctx.runQuery(api.runs.getVideo, { videoId: run.videoId })
        : null;

      await ctx.runMutation(api.workflow.addStep, {
        runId: args.runId,
        role: "producer",
        status: "completed",
        order: 1,
        inputSummary: `${run.title} - ${video?.publicUrl ?? run.sourceUrl ?? run.episodeTitle}`,
        outputSummary: "Validated R2 video metadata and created a transcription job.",
      });

      transcriberStepId = await ctx.runMutation(api.workflow.addStep, {
        runId: args.runId,
        role: "transcriber",
        status: "running",
        order: 2,
        inputSummary: "Groq Whisper transcription from uploaded R2 media.",
        outputSummary: "Transcription is running.",
      });

      if (video?.fileSize && video.fileSize > groqMaxDirectBytes) {
        await ctx.runMutation(api.workflow.updateStep, {
          stepId: transcriberStepId,
          status: "running",
          outputSummary:
            "Video is larger than Groq's direct upload limit; run the chunked transcription worker.",
        });
        await ctx.runMutation(api.runs.updateRunStatus, {
          runId: args.runId,
          status: "awaiting_transcription_worker",
        });
        return;
      }

      const transcription = await transcribeVideoUrl(video);
      const wordCount = transcription.text.split(/\s+/).filter(Boolean).length;

      await ctx.runMutation(api.runs.updateRunTranscript, {
        runId: args.runId,
        sourceText: transcription.text,
        sourceType: "groq_transcript",
        chunks: chunkTranscription(transcription),
      });

      await ctx.runMutation(api.workflow.updateStep, {
        stepId: transcriberStepId,
        status: "completed",
        outputSummary: `Prepared Groq transcript with ${wordCount} words and word-level timestamps.`,
        completedAt: Date.now(),
      });

      await ctx.runMutation(api.runs.updateRunStatus, {
        runId: args.runId,
        status: "transcribed",
      });
    } catch (error) {
      const outputSummary =
        error instanceof Error ? error.message : "Transcription failed.";

      if (transcriberStepId) {
        await ctx.runMutation(api.workflow.updateStep, {
          stepId: transcriberStepId,
          status: "failed",
          outputSummary,
          completedAt: Date.now(),
        });
      } else {
        await ctx.runMutation(api.workflow.addStep, {
          runId: args.runId,
          role: "transcriber",
          status: "failed",
          order: 2,
          inputSummary: "Groq Whisper transcription from uploaded R2 media.",
          outputSummary,
        });
      }

      await ctx.runMutation(api.runs.updateRunStatus, {
        runId: args.runId,
        status: "failed",
        completedAt: Date.now(),
      });
      throw error;
    }
  },
});

async function transcribeVideoUrl(video: Doc<"videos"> | null) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  if (!video?.publicUrl) {
    throw new Error("Uploaded media must have a public R2 URL.");
  }

  const filename = filenameFromUrl(video.publicUrl) || video.fileName;
  const extension = filename.split(".").pop()?.toLowerCase();

  if (!extension || !transcribableExtensions.has(extension)) {
    throw new Error(`Groq transcription does not support .${extension ?? "unknown"} files.`);
  }

  const groq = new Groq({ apiKey });
  const transcription = (await groq.audio.transcriptions.create({
    model: "whisper-large-v3",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
    url: video.publicUrl,
  })) as GroqVerboseTranscription;

  if (!transcription.text.trim()) {
    throw new Error("Groq returned an empty transcript.");
  }

  return transcription;
}

function chunkTranscription(transcription: GroqVerboseTranscription) {
  const words = Array.isArray(transcription.words) ? transcription.words : [];

  if (!words.length) {
    return [{ chunkIndex: 0, text: transcription.text, payload: transcription }];
  }

  const metadata = { ...transcription };
  delete metadata.words;
  const chunks = [];

  for (let index = 0; index < words.length; index += wordChunkSize) {
    const wordSlice = words.slice(index, index + wordChunkSize);

    chunks.push({
      chunkIndex: chunks.length,
      text: textFromWords(wordSlice),
      payload:
        index === 0
          ? { ...metadata, words: wordSlice }
          : { words: wordSlice },
    });
  }

  return chunks;
}

function textFromWords(words: unknown[]) {
  return words
    .map((word) =>
      word &&
      typeof word === "object" &&
      "word" in word &&
      typeof word.word === "string"
        ? word.word
        : "",
    )
    .filter(Boolean)
    .join(" ");
}

function filenameFromUrl(url: string) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
  } catch {
    return "";
  }
}
