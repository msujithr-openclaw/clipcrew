import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const candidate = v.object({
  title: v.string(),
  startTime: v.string(),
  endTime: v.string(),
  transcript: v.string(),
  hook: v.number(),
  clarity: v.number(),
  emotion: v.number(),
  novelty: v.number(),
  shareability: v.number(),
  totalScore: v.number(),
  reason: v.string(),
  status: v.optional(v.string()),
});

export const listByRun = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    const clips = await ctx.db
      .query("candidateClips")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();

    return clips.sort((a, b) => b.totalScore - a.totalScore);
  },
});

export const addMany = mutation({
  args: {
    runId: v.id("runs"),
    candidates: v.array(candidate),
  },
  handler: async (ctx, args) => {
    const ids = [];

    for (const clip of args.candidates) {
      ids.push(
        await ctx.db.insert("candidateClips", {
          ...clip,
          runId: args.runId,
          status: clip.status ?? "suggested",
        }),
      );
    }

    return ids;
  },
});

export const updateStatus = mutation({
  args: {
    clipId: v.id("candidateClips"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.clipId, { status: args.status });
  },
});
