import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByRun = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("exportReceipts")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
  },
});

export const createReceipt = mutation({
  args: {
    runId: v.id("runs"),
    clipId: v.id("candidateClips"),
    status: v.optional(v.string()),
    artifactUrl: v.string(),
    hook: v.string(),
    caption: v.string(),
    hashtags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("exportReceipts", {
      runId: args.runId,
      clipId: args.clipId,
      status: args.status ?? "ready_to_publish",
      artifactUrl: args.artifactUrl,
      hook: args.hook,
      caption: args.caption,
      hashtags: args.hashtags,
      createdAt: Date.now(),
    });
  },
});

export const clearByRun = mutation({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    const receipts = await ctx.db
      .query("exportReceipts")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();

    for (const receipt of receipts) {
      await ctx.db.delete(receipt._id);
    }
  },
});
