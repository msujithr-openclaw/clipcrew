import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createRun = mutation({
  args: {
    title: v.string(),
    episodeTitle: v.string(),
    sourceType: v.optional(v.string()),
    sourceText: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("runs", {
      title: args.title,
      episodeTitle: args.episodeTitle,
      sourceType: args.sourceType ?? "transcript",
      sourceText: args.sourceText ?? "",
      sourceUrl: args.sourceUrl,
      status: "created",
      createdAt: Date.now(),
    });
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
