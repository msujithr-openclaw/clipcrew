import { v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";
import { runDeterministicClipCrew } from "../lib/workflow/runClipCrew";

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

    const steps = runDeterministicClipCrew(run);

    for (const step of steps) {
      await ctx.runMutation(api.workflow.addStep, {
        runId: args.runId,
        role: step.role,
        status: step.status,
        order: step.order,
        inputSummary: step.inputSummary,
        outputSummary: step.outputSummary,
      });
    }

    await ctx.runMutation(api.runs.updateRunStatus, {
      runId: args.runId,
      status: "awaiting_approval",
      completedAt: Date.now(),
    });
  },
});
