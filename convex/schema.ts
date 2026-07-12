import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  videos: defineTable({
    title: v.string(),
    fileName: v.string(),
    durationSeconds: v.number(),
    sourceType: v.string(),
    storageProvider: v.string(),
    r2Key: v.optional(v.string()),
    publicUrl: v.optional(v.string()),
    contentType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    uploadStatus: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  runs: defineTable({
    title: v.string(),
    episodeTitle: v.string(),
    videoId: v.id("videos"),
    sourceType: v.string(),
    sourceText: v.string(),
    sourceUrl: v.optional(v.string()),
    status: v.string(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_video", ["videoId", "createdAt"]),

  transcriptionChunks: defineTable({
    runId: v.id("runs"),
    chunkIndex: v.number(),
    text: v.string(),
    payload: v.any(),
    createdAt: v.number(),
  }).index("by_run", ["runId", "chunkIndex"]),

  workflowSteps: defineTable({
    runId: v.id("runs"),
    role: v.string(),
    status: v.string(),
    order: v.number(),
    inputSummary: v.string(),
    outputSummary: v.string(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_run", ["runId", "order"]),

  candidateClips: defineTable({
    runId: v.id("runs"),
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
    status: v.string(),
  })
    .index("by_run", ["runId"])
    .index("by_run_score", ["runId", "totalScore"]),

  exportReceipts: defineTable({
    runId: v.id("runs"),
    clipId: v.id("candidateClips"),
    status: v.string(),
    artifactUrl: v.string(),
    hook: v.string(),
    caption: v.string(),
    hashtags: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_run", ["runId"]),
});
