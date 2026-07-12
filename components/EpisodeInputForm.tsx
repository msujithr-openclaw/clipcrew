"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/convex/_generated/api";

const sampleTranscript = `Host: Most podcast clips fail because creators pick the loudest moment, not the clearest story.

Guest: The best clip has a hook, context, tension, and a payoff. If someone can understand it without the full episode, it can travel.

Host: So the workflow should score for clarity and emotion, not just keywords.

Guest: Exactly. A great social team would find the moments, explain why they work, write the caption, and let the creator approve before anything ships.`;

type RunInput = {
  title: string;
  episodeTitle: string;
  sourceUrl?: string;
  sourceText: string;
  sourceType: string;
};

const hasConvexUrl = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

export function EpisodeInputForm() {
  if (!hasConvexUrl) {
    return <RunForm mode="local" />;
  }

  return <ConvexRunForm />;
}

function ConvexRunForm() {
  const createRun = useMutation(api.runs.createRun);
  const router = useRouter();

  return (
    <RunForm
      mode="convex"
      onCreateRun={async (input) => {
        const runId = await createRun(input);
        router.push(`/runs/${runId}`);
      }}
    />
  );
}

function RunForm({
  mode,
  onCreateRun,
}: {
  mode: "convex" | "local";
  onCreateRun?: (input: RunInput) => Promise<void>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("Creator Growth Show");
  const [episodeTitle, setEpisodeTitle] = useState(
    "Why podcast clips need a story"
  );
  const [sourceUrl, setSourceUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const sourceText = transcript.trim() || sampleTranscript;
    const input: RunInput = {
      title: title.trim() || "Untitled Podcast",
      episodeTitle: episodeTitle.trim() || "Untitled Episode",
      sourceUrl: sourceUrl.trim() || undefined,
      sourceText,
      sourceType: transcript.trim() ? "transcript" : "sample_transcript",
    };

    try {
      if (onCreateRun) {
        await onCreateRun(input);
        return;
      }

      const localRunId = `local-${Date.now().toString(36)}`;
      window.localStorage.setItem(`clipcrew:${localRunId}`, JSON.stringify(input));
      router.push(`/runs/${localRunId}`);
    } catch {
      setError("Could not create the run. Using a local demo run instead.");
      const localRunId = `local-${Date.now().toString(36)}`;
      window.localStorage.setItem(`clipcrew:${localRunId}`, JSON.stringify(input));
      router.push(`/runs/${localRunId}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/15 bg-white/[0.08] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-7">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-200">
          Generate Clip Plan
        </p>
        <h2 className="text-2xl font-bold text-white">Start with an episode</h2>
        <p className="text-sm leading-6 text-zinc-300">
          Paste a transcript or leave it empty to use the built-in demo sample.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-200">Show or podcast title</span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-white outline-none transition focus:border-teal-300"
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-200">Episode title</span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-white outline-none transition focus:border-teal-300"
            onChange={(event) => setEpisodeTitle(event.target.value)}
            value={episodeTitle}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-200">Optional source URL</span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-white outline-none transition focus:border-teal-300"
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            type="url"
            value={sourceUrl}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-200">Transcript</span>
          <textarea
            className="min-h-40 w-full resize-y rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-teal-300"
            onChange={(event) => setTranscript(event.target.value)}
            placeholder="Paste transcript here, or use the sample transcript."
            value={transcript}
          />
        </label>

        <button
          className="w-full rounded-2xl bg-teal-300 px-5 py-4 text-base font-black text-zinc-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Creating run..." : "Generate Clip Plan"}
        </button>

        <button
          className="w-full rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
          onClick={() => setTranscript(sampleTranscript)}
          type="button"
        >
          Use sample transcript
        </button>

        {error ? <p className="text-sm text-amber-200">{error}</p> : null}
        <p className="text-xs leading-5 text-zinc-400">
          {mode === "convex"
            ? "Convex is configured; this creates a stored run."
            : "Convex URL is not configured; this will create a local demo run id."}
        </p>
      </form>
    </section>
  );
}
