import type { RunInput, WorkflowRole, WorkflowStep } from "./types";

const roles: Array<{ role: WorkflowRole; label: string }> = [
  { role: "producer", label: "Producer" },
  { role: "transcriber", label: "Transcriber" },
  { role: "moment_scorer", label: "Moment Scorer" },
  { role: "judge_panel", label: "Judge Panel" },
  { role: "caption_writer", label: "Caption Writer" },
  { role: "approval_gate", label: "Approval Gate" },
  { role: "exporter", label: "Exporter" },
];

export function runDeterministicClipCrew(input: RunInput): WorkflowStep[] {
  const transcript = input.sourceText?.trim() ?? "";

  if (!transcript) {
    throw new Error("Transcript is required before scoring.");
  }

  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const sourceName = input.video?.fileName ?? input.sourceUrl ?? input.episodeTitle;
  const now = Date.now();

  const summaries: Record<WorkflowRole, { input: string; output: string }> = {
    producer: {
      input: `${input.title} - ${sourceName}`,
      output: "Validated video metadata and created a seven-role clip plan.",
    },
    transcriber: {
      input:
        input.sourceType === "groq_transcript"
          ? "Using Groq Whisper transcription from the uploaded media."
          : "Using provided transcript as the source of truth.",
      output: `Prepared transcript with ${wordCount} words for scoring.`,
    },
    moment_scorer: {
      input: "Transcript with hook, clarity, emotion, novelty, and shareability rubric.",
      output: "Identified 5 candidate moments and ranked them by total score.",
    },
    judge_panel: {
      input: "Ranked candidate moments with score reasons.",
      output: "Advanced the strongest standalone story moments for creator review.",
    },
    caption_writer: {
      input: "Top candidate clip themes and transcript snippets.",
      output: "Drafted hook, caption direction, hashtags, and subtitle-style lines.",
    },
    approval_gate: {
      input: "Creator-ready candidates with scorecards and captions.",
      output: "Waiting for creator approval before export receipt generation.",
    },
    exporter: {
      input: "Approved-clip placeholder for demo trace completeness.",
      output: "Preview/export step is ready after approval in the next phase.",
    },
  };

  return roles.map(({ role }, index) => ({
    role,
    status: "completed",
    order: index + 1,
    inputSummary: summaries[role].input,
    outputSummary: summaries[role].output,
    startedAt: now + index * 1000,
    completedAt: now + index * 1000 + 500,
  }));
}

export function workflowRoleLabel(role: string) {
  return roles.find((item) => item.role === role)?.label ?? role;
}
