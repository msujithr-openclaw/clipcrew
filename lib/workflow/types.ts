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
  sourceText: string;
  sourceUrl?: string;
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
