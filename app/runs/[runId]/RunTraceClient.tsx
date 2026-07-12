"use client";

import { useQuery } from "convex/react";
import { useSyncExternalStore } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { WorkflowTimeline } from "@/components/WorkflowTimeline";
import { runDeterministicClipCrew } from "@/lib/workflow/runClipCrew";
import { sampleTranscript } from "@/lib/workflow/sampleTranscript";
import type { RunInput, WorkflowStep } from "@/lib/workflow/types";

const hasConvexUrl = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

export function RunTraceClient({ runId }: { runId: string }) {
  if (runId.startsWith("local-") || !hasConvexUrl) {
    return <LocalRunTrace runId={runId} />;
  }

  return <ConvexRunTrace runId={runId} />;
}

function LocalRunTrace({ runId }: { runId: string }) {
  const storedRun = useSyncExternalStore(
    () => () => {},
    () => window.localStorage.getItem(`clipcrew:${runId}`),
    () => null,
  );
  const input = parseRunInput(storedRun) ?? {
      title: "Creator Growth Show",
      episodeTitle: "Why podcast clips need a story",
      sourceType: "sample_transcript",
      sourceText: sampleTranscript,
    };

  return (
    <RunShell
      episodeTitle={input.episodeTitle}
      runId={runId}
      source="Local deterministic workflow"
      status="awaiting_approval"
      steps={runDeterministicClipCrew(input)}
      title={input.title}
      videoPublicUrl={input.video?.publicUrl}
    />
  );
}

function parseRunInput(value: string | null): RunInput | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function ConvexRunTrace({ runId }: { runId: string }) {
  const convexRunId = runId as Id<"runs">;
  const run = useQuery(api.runs.getRun, { runId: convexRunId });
  const storedSteps = useQuery(api.workflow.listByRun, { runId: convexRunId });
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

  const fallbackSteps = runDeterministicClipCrew(run);
  const steps = storedSteps.length ? storedSteps : fallbackSteps;

  return (
    <RunShell
      episodeTitle={run.episodeTitle}
      runId={runId}
      source={
        storedSteps.length
          ? "Convex workflow trace"
          : "Deterministic preview while Convex action deploys"
      }
      status={run.status}
      steps={steps}
      title={run.title}
      videoPublicUrl={video?.publicUrl}
    />
  );
}

function RunShell({
  episodeTitle,
  runId,
  source,
  status,
  steps = [],
  title,
  videoPublicUrl,
}: {
  episodeTitle?: string;
  runId: string;
  source?: string;
  status: string;
  steps?: WorkflowStep[];
  title: string;
  videoPublicUrl?: string;
}) {
  return (
    <section className="mx-auto max-w-5xl rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
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

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <p className="break-all rounded-2xl bg-zinc-50 p-4 font-mono text-sm text-zinc-600">
          {runId}
        </p>
        {source ? <p className="text-sm text-zinc-500">{source}</p> : null}
      </div>

      {videoPublicUrl ? (
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

      {steps.length ? (
        <WorkflowTimeline steps={steps} />
      ) : (
        <p className="mt-8 rounded-2xl bg-zinc-50 p-5 text-zinc-500">
          Workflow trace is not available yet.
        </p>
      )}
    </section>
  );
}
