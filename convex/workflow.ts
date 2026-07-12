import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByRun = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workflowSteps")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
  },
});

export const addStep = mutation({
  args: {
    runId: v.id("runs"),
    role: v.string(),
    status: v.string(),
    order: v.number(),
    inputSummary: v.string(),
    outputSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("workflowSteps", {
      runId: args.runId,
      role: args.role,
      status: args.status,
      order: args.order,
      inputSummary: args.inputSummary,
      outputSummary: args.outputSummary ?? "",
      startedAt: Date.now(),
    });
  },
});

export const clearByRun = mutation({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    const steps = await ctx.db
      .query("workflowSteps")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();

    for (const step of steps) {
      await ctx.db.delete(step._id);
    }
  },
});

export const updateStep = mutation({
  args: {
    stepId: v.id("workflowSteps"),
    status: v.optional(v.string()),
    outputSummary: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.stepId, {
      status: args.status,
      outputSummary: args.outputSummary,
      completedAt: args.completedAt,
    });
  },
});
