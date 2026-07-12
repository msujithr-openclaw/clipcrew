import { v } from "convex/values";
import { api } from "./_generated/api";
import { mutation, query } from "./_generated/server";

export const createRun = mutation({
  args: {
    title: v.string(),
    episodeTitle: v.string(),
    sourceType: v.optional(v.string()),
    sourceText: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    video: v.optional(
      v.object({
        title: v.string(),
        fileName: v.string(),
        durationSeconds: v.number(),
        sourceType: v.string(),
        storageProvider: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const videoId = args.video
      ? await ctx.db.insert("videos", {
          ...args.video,
          createdAt: Date.now(),
        })
      : undefined;

    const runId = await ctx.db.insert("runs", {
      title: args.title,
      episodeTitle: args.episodeTitle,
      videoId,
      sourceType: args.sourceType ?? "transcript",
      sourceText: args.sourceText ?? "",
      sourceUrl: args.sourceUrl,
      status: "created",
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, api.actions.runClipCrew, { runId });

    return runId;
  },
});

export const getRun = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.runId);
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
