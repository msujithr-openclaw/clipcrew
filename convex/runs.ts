import { v } from "convex/values";
import { api } from "./_generated/api";
import { mutation, query } from "./_generated/server";

export const createRun = mutation({
  args: {
    title: v.string(),
    episodeTitle: v.string(),
    videoId: v.id("videos"),
    sourceType: v.optional(v.string()),
    sourceText: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const runId = await ctx.db.insert("runs", {
      title: args.title,
      episodeTitle: args.episodeTitle,
      videoId: args.videoId,
      sourceType: args.sourceType ?? "r2_video",
      sourceText: args.sourceText ?? "",
      sourceUrl: args.sourceUrl,
      status: "created",
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, api.actions.runClipCrew, { runId });

    return runId;
  },
});

export const addVideo = mutation({
  args: {
    title: v.string(),
    fileName: v.string(),
    durationSeconds: v.number(),
    sourceType: v.literal("r2_upload"),
    storageProvider: v.literal("r2"),
    r2Key: v.string(),
    publicUrl: v.string(),
    contentType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    uploadStatus: v.literal("uploaded"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("videos", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const listVideos = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("videos")
      .withIndex("by_createdAt")
      .order("desc")
      .take(50);
  },
});

export const listRuns = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("runs")
      .withIndex("by_createdAt")
      .order("desc")
      .take(50);
  },
});

export const getRun = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.runId);
  },
});

export const listByVideo = query({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("runs")
      .withIndex("by_video", (q) => q.eq("videoId", args.videoId))
      .order("desc")
      .take(50);
  },
});

export const getVideo = query({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.videoId);
  },
});

export const listTranscriptionChunks = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transcriptionChunks")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
  },
});

export const updateRunStatus = mutation({
  args: {
    runId: v.id("runs"),
    status: v.string(),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: args.status,
      completedAt: args.completedAt,
    });
  },
});

export const updateRunTranscript = mutation({
  args: {
    runId: v.id("runs"),
    sourceText: v.string(),
    sourceType: v.string(),
    chunks: v.array(
      v.object({
        chunkIndex: v.number(),
        text: v.string(),
        payload: v.any(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      sourceText: args.sourceText,
      sourceType: args.sourceType,
    });

    const existingChunks = await ctx.db
      .query("transcriptionChunks")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();

    for (const chunk of existingChunks) {
      await ctx.db.delete(chunk._id);
    }

    for (const chunk of args.chunks) {
      await ctx.db.insert("transcriptionChunks", {
        runId: args.runId,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        payload: chunk.payload,
        createdAt: Date.now(),
      });
    }
  },
});
