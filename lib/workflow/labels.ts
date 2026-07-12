const runStatusLabels: Record<string, string> = {
  created: "Starting",
  running: "Transcribing",
  awaiting_transcription_worker: "Needs transcription",
  transcribed: "Ready to find moments",
  scored: "Ready for review",
  rendering: "Exporting clips",
  rendered: "Clips ready",
  completed: "Done",
  failed: "Failed",
};

export function runStatusLabel(status: string) {
  return runStatusLabels[status] ?? status.replace(/_/g, " ");
}

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}
