import type { Id } from "@/convex/_generated/dataModel";

export type WorkflowRole =
  | "producer"
  | "transcriber"
  | "moment_scorer"
  | "judge_panel"
  | "caption_writer"
  | "approval_gate"
  | "exporter";

export type WorkflowStatus = "pending" | "running" | "completed" | "failed";

export type RunInput = {
  title: string;
  episodeTitle: string;
  sourceType: string;
  sourceText?: string;
  sourceUrl?: string;
  videoId: Id<"videos">;
  video?: VideoMetadata;
};

export type VideoMetadata = {
  title: string;
  fileName: string;
  durationSeconds: number;
  sourceType: "r2_upload";
  storageProvider: "r2";
  r2Key?: string;
  publicUrl?: string;
  contentType?: string;
  fileSize?: number;
  uploadStatus?: "pending" | "uploaded" | "failed";
};

export type WorkflowStep = {
  role: WorkflowRole | string;
  status: WorkflowStatus | string;
  order: number;
  inputSummary: string;
  outputSummary: string;
  startedAt: number;
  completedAt?: number;
};
