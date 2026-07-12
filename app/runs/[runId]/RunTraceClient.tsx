"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { WorkflowTimeline } from "@/components/WorkflowTimeline";
import type { WorkflowStep } from "@/lib/workflow/types";

const hasConvexUrl = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
type CandidateClip = Doc<"candidateClips">;
type ExportReceipt = Doc<"exportReceipts">;

export function RunTraceClient({ runId }: { runId: string }) {
  if (!hasConvexUrl) {
    return (
      <RunShell
        runId={runId}
        status="missing_config"
        title="Connect Convex before viewing runs"
      />
    );
  }

  return <ConvexRunTrace runId={runId} />;
}

function ConvexRunTrace({ runId }: { runId: string }) {
  const convexRunId = runId as Id<"runs">;
  const run = useQuery(api.runs.getRun, { runId: convexRunId });
  const storedSteps = useQuery(api.workflow.listByRun, { runId: convexRunId });
  const candidateClips = useQuery(api.candidates.listByRun, {
    runId: convexRunId,
  });
  const exportReceipts = useQuery(api.receipts.listByRun, {
    runId: convexRunId,
  });
  const updateCandidateStatus = useMutation(api.candidates.updateStatus);
  const video = useQuery(
    api.runs.getVideo,
    run?.videoId ? { videoId: run.videoId } : "skip",
  );

  if (run === undefined || storedSteps === undefined) {
    return <RunShell runId={runId} status="loading" title="Loading Convex run" />;
  }

  if (run === null) {
    return <RunShell runId={runId} status="not_found" title="Run not found" />;
  }

  return (
    <RunShell
      episodeTitle={run.episodeTitle}
      candidateClips={candidateClips}
      exportReceipts={exportReceipts}
      runId={runId}
      onCandidateStatusChange={(clipId, status) =>
        updateCandidateStatus({ clipId, status })
      }
      showCandidateClips
      showScoringWorker={run.status === "transcribed"}
      showTranscriptionWorker={run.status === "awaiting_transcription_worker"}
      source="Convex workflow trace"
      status={run.status}
      steps={storedSteps}
      title={run.title}
      videoPublicUrl={video?.publicUrl}
    />
  );
}

function RunShell({
  episodeTitle,
  candidateClips,
  exportReceipts,
  runId,
  onCandidateStatusChange,
  showCandidateClips = false,
  showScoringWorker = false,
  showTranscriptionWorker = false,
  source,
  status,
  steps = [],
  title,
  videoPublicUrl,
}: {
  episodeTitle?: string;
  candidateClips?: CandidateClip[];
  exportReceipts?: ExportReceipt[];
  runId: string;
  onCandidateStatusChange?: (
    clipId: Id<"candidateClips">,
    status: "approved" | "rejected",
  ) => Promise<unknown>;
  showCandidateClips?: boolean;
  showScoringWorker?: boolean;
  showTranscriptionWorker?: boolean;
  source?: string;
  status: string;
  steps?: WorkflowStep[];
  title: string;
  videoPublicUrl?: string;
}) {
  const hasCandidates = Boolean(candidateClips?.length);
  const hasExports = Boolean(exportReceipts?.length);
  const [workerStatus, setWorkerStatus] = useState("");
  const [isStartingWorker, setIsStartingWorker] = useState(false);
  const [scoringStatus, setScoringStatus] = useState("");
  const [isStartingScoring, setIsStartingScoring] = useState(false);
  const [renderStatus, setRenderStatus] = useState("");
  const [isStartingRender, setIsStartingRender] = useState(false);
  const [candidateStatusMessage, setCandidateStatusMessage] = useState("");
  const [updatingClipId, setUpdatingClipId] =
    useState<Id<"candidateClips"> | null>(null);

  async function startTranscriptionWorker() {
    setIsStartingWorker(true);
    setWorkerStatus("");

    try {
      const response = await fetch("/api/transcribe-run", {
        body: JSON.stringify({ runId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Could not start transcription worker.");
      }

      setWorkerStatus("Transcription started.");
    } catch (error) {
      setWorkerStatus(
        error instanceof Error
          ? error.message
          : "Could not start transcription worker.",
      );
    } finally {
      setIsStartingWorker(false);
    }
  }

  async function startScoringWorker() {
    setIsStartingScoring(true);
    setScoringStatus("");

    try {
      const response = await fetch("/api/score-run", {
        body: JSON.stringify({ runId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Could not start scoring worker.");
      }

      setScoringStatus("Finding clip ideas.");
    } catch (error) {
      setScoringStatus(
        error instanceof Error ? error.message : "Could not start scoring worker.",
      );
    } finally {
      setIsStartingScoring(false);
    }
  }

  async function updateCandidate(
    clipId: Id<"candidateClips">,
    status: "approved" | "rejected",
  ) {
    if (!onCandidateStatusChange) {
      return;
    }

    setCandidateStatusMessage("");
    setUpdatingClipId(clipId);

    try {
      await onCandidateStatusChange(clipId, status);
    } catch {
      setCandidateStatusMessage("Could not update candidate status.");
    } finally {
      setUpdatingClipId(null);
    }
  }

  async function startRenderWorker() {
    setIsStartingRender(true);
    setRenderStatus("");

    try {
      const response = await fetch("/api/render-approved-run", {
        body: JSON.stringify({ runId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Could not start render worker.");
      }

      setRenderStatus("Generating approved clips.");
    } catch (error) {
      setRenderStatus(
        error instanceof Error ? error.message : "Could not start render worker.",
      );
    } finally {
      setIsStartingRender(false);
    }
  }

  return (
    <section className="w-full rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-zinc-400">
            ClipCrew Run
          </p>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
            {title}
          </h1>
          {episodeTitle ? (
            <p className="mt-3 text-lg text-zinc-500">{episodeTitle}</p>
          ) : null}
        </div>
        <span className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white">
          {status}
        </span>
      </div>

      <ProgressStrip
        approvedCount={
          candidateClips?.filter((clip) => clip.status === "approved").length ?? 0
        }
        candidateCount={candidateClips?.length ?? 0}
        exportCount={exportReceipts?.length ?? 0}
        status={status}
      />

      {showTranscriptionWorker ? (
        <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
            Next action
          </p>
          <p className="mt-2 text-sm font-semibold text-amber-900">
            This video needs local chunked transcription.
          </p>
          <button
            className="mt-4 w-full rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            disabled={isStartingWorker}
            onClick={startTranscriptionWorker}
            type="button"
          >
            {isStartingWorker ? "Starting..." : "Start Transcription"}
          </button>
          {workerStatus ? (
            <p className="mt-3 text-sm text-amber-900">{workerStatus}</p>
          ) : null}
        </div>
      ) : null}

      {showScoringWorker ? (
        <div className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            Next action
          </p>
          <p className="mt-2 text-sm font-semibold text-blue-950">
            Transcript is ready. Find candidate reel moments next.
          </p>
          <button
            className="mt-4 w-full rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            disabled={isStartingScoring}
            onClick={startScoringWorker}
            type="button"
          >
            {isStartingScoring ? "Finding ideas..." : "Find Clip Ideas"}
          </button>
          {scoringStatus ? (
            <p className="mt-3 text-sm text-blue-950">{scoringStatus}</p>
          ) : null}
        </div>
      ) : null}

      {videoPublicUrl && (hasCandidates || hasExports) ? (
        <details className="mt-6 rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
          <summary className="cursor-pointer text-sm font-bold uppercase tracking-[0.16em] text-zinc-500">
            Source video
          </summary>
          <video
            className="mt-4 aspect-video w-full rounded-2xl bg-black object-cover"
            controls
            src={videoPublicUrl}
          />
        </details>
      ) : null}

      {videoPublicUrl && !hasCandidates && !hasExports ? (
        <div className="mt-6 rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
          <video
            className="aspect-video w-full rounded-2xl bg-black object-cover"
            controls
            src={videoPublicUrl}
          />
          <a
            className="mt-3 block break-all text-sm text-zinc-600 underline"
            href={videoPublicUrl}
            rel="noreferrer"
            target="_blank"
          >
            {videoPublicUrl}
          </a>
        </div>
      ) : null}

      {showCandidateClips ? (
        <CandidateClips
          candidateClips={candidateClips}
          exportReceipts={exportReceipts}
          isStartingRender={isStartingRender}
          onStatusChange={onCandidateStatusChange ? updateCandidate : undefined}
          onStartRender={startRenderWorker}
          renderStatus={renderStatus}
          runStatus={status}
          statusMessage={candidateStatusMessage}
          updatingClipId={updatingClipId}
        />
      ) : null}

      <details className="mt-8 border-t border-zinc-200 pt-6">
        <summary className="cursor-pointer text-sm font-bold uppercase tracking-[0.16em] text-zinc-500">
          Workflow trace
        </summary>
        {steps.length ? (
          <WorkflowTimeline steps={steps} />
        ) : (
          <p className="mt-4 rounded-2xl bg-zinc-50 p-5 text-zinc-500">
            Workflow trace is not available yet.
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <p className="break-all rounded-2xl bg-zinc-50 p-4 font-mono text-sm text-zinc-600">
            {runId}
          </p>
          {source ? <p className="text-sm text-zinc-500">{source}</p> : null}
        </div>
      </details>
    </section>
  );
}

function ProgressStrip({
  approvedCount,
  candidateCount,
  exportCount,
  status,
}: {
  approvedCount: number;
  candidateCount: number;
  exportCount: number;
  status: string;
}) {
  const steps = [
    { label: "Video", done: true },
    {
      label: "Transcript",
      done: ["transcribed", "scored", "rendering", "rendered"].includes(status),
      active: status === "awaiting_transcription_worker" || status === "running",
    },
    {
      label: "Ideas",
      done: candidateCount > 0,
      active: status === "transcribed",
    },
    {
      label: "Approval",
      done: approvedCount > 0,
      active: candidateCount > 0 && approvedCount === 0,
    },
    {
      label: "Exports",
      done: exportCount > 0,
      active: approvedCount > 0 && exportCount === 0,
    },
  ];

  return (
    <div className="mt-6 grid gap-2 sm:grid-cols-5">
      {steps.map((step, index) => (
        <div
          className={`rounded-2xl border p-3 ${
            step.done
              ? "border-emerald-200 bg-emerald-50"
              : step.active
                ? "border-zinc-950 bg-white"
                : "border-zinc-200 bg-zinc-50"
          }`}
          key={step.label}
        >
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
            {index + 1}
          </p>
          <p className="mt-1 text-sm font-black text-zinc-950">{step.label}</p>
        </div>
      ))}
    </div>
  );
}

function CandidateClips({
  candidateClips,
  exportReceipts,
  isStartingRender,
  onStatusChange,
  onStartRender,
  renderStatus,
  runStatus,
  statusMessage,
  updatingClipId,
}: {
  candidateClips?: CandidateClip[];
  exportReceipts?: ExportReceipt[];
  isStartingRender: boolean;
  onStatusChange?: (
    clipId: Id<"candidateClips">,
    status: "approved" | "rejected",
  ) => Promise<void>;
  onStartRender: () => Promise<void>;
  renderStatus: string;
  runStatus: string;
  statusMessage: string;
  updatingClipId: Id<"candidateClips"> | null;
}) {
  const approvedCount =
    candidateClips?.filter((clip) => clip.status === "approved").length ?? 0;
  const exportCount = exportReceipts?.length ?? 0;
  const isRendering = isStartingRender || runStatus === "rendering";
  const showRenderAction = approvedCount > exportCount && !isRendering;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
            Review Clips
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">
            Approve the best ideas
          </h2>
        </div>
        {candidateClips ? (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-zinc-600">
            {candidateClips.length} clips
          </span>
        ) : null}
      </div>

      {exportReceipts?.length ? (
        <div className="mt-4 rounded-3xl border border-zinc-200 bg-white p-5">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
            Download Clips
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {exportReceipts.map((receipt) => (
              <article
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 transition hover:border-zinc-400 hover:bg-white"
                key={receipt._id}
              >
                <video
                  className="aspect-[9/16] w-full rounded-xl bg-black object-cover"
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  src={receipt.artifactUrl}
                />
                <span className="mt-3 block font-black text-zinc-950">
                  {receipt.hook}
                </span>
                <span className="mt-1 block text-sm text-zinc-500">
                  Ready MP4 export · {receipt.status}
                </span>
                <a
                  className="mt-3 inline-block rounded-full bg-zinc-950 px-3 py-2 text-xs font-bold text-white"
                  href={receipt.artifactUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open MP4
                </a>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {isRendering ? (
        <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            Rendering
          </p>
          <p className="mt-2 text-sm font-semibold text-emerald-950">
            Generating approved clips.
          </p>
        </div>
      ) : null}

      {showRenderAction ? (
        <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            Next action
          </p>
          <p className="mt-2 text-sm font-semibold text-emerald-950">
            {approvedCount - exportCount} approved clip
            {approvedCount - exportCount === 1 ? "" : "s"} ready for export.
          </p>
          <button
            className="mt-4 w-full rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            disabled={isStartingRender}
            onClick={onStartRender}
            type="button"
          >
            {isStartingRender ? "Generating..." : "Generate Approved Clips"}
          </button>
          {renderStatus ? (
            <p className="mt-3 text-sm text-emerald-950">{renderStatus}</p>
          ) : null}
        </div>
      ) : null}

      {candidateClips === undefined ? (
        <p className="mt-4 rounded-2xl bg-zinc-50 p-5 text-zinc-500">
          Loading candidate clips...
        </p>
      ) : null}

      {candidateClips?.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-zinc-50 p-5 text-zinc-500">
          No candidate clips yet. Run scoring to generate review candidates.
        </p>
      ) : null}

      {candidateClips?.length ? (
        <div className="mt-4 grid gap-4">
          {candidateClips.map((clip) => {
            const isUpdating = updatingClipId === clip._id;
            const isApproved = clip.status === "approved";
            const isRejected = clip.status === "rejected";

            return (
              <article
                className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5"
                key={clip._id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-sm text-zinc-500">
                      {clip.startTime} - {clip.endTime}
                    </p>
                    <h3 className="mt-2 text-xl font-black text-zinc-950">
                      {clip.title}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black">{clip.totalScore}</p>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
                      Score
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                    {clip.status}
                  </span>
                  <button
                    className={`rounded-2xl px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isApproved
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-950 text-white hover:bg-zinc-800"
                    }`}
                    disabled={!onStatusChange || isUpdating}
                    onClick={() => onStatusChange?.(clip._id, "approved")}
                    type="button"
                  >
                    {isUpdating ? "Saving..." : "Approve"}
                  </button>
                  <button
                    className={`rounded-2xl px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isRejected
                        ? "bg-rose-600 text-white"
                        : "border border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
                    }`}
                    disabled={!onStatusChange || isUpdating}
                    onClick={() => onStatusChange?.(clip._id, "rejected")}
                    type="button"
                  >
                    {isUpdating ? "Saving..." : "Reject"}
                  </button>
                </div>

                <p className="mt-4 text-sm leading-6 text-zinc-600">
                  {clip.transcript}
                </p>
                <p className="mt-3 text-sm font-semibold text-zinc-700">
                  {clip.reason}
                </p>
              </article>
            );
          })}
        </div>
      ) : null}

      {statusMessage ? (
        <p className="mt-4 text-sm text-amber-700">{statusMessage}</p>
      ) : null}
    </section>
  );
}
