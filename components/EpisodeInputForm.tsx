"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { sampleTranscript } from "@/lib/workflow/sampleTranscript";
import { runInputFromVideo, sampleVideos } from "@/lib/workflow/sampleVideos";
import type { ChangeEvent, FormEvent } from "react";
import type { RunInput, VideoMetadata } from "@/lib/workflow/types";


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
        const runId = await withTimeout(createRun(input), 2500);
        router.push(`/runs/${runId}`);
      }}
    />
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("Convex run creation timed out")),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
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
  const [selectedVideo, setSelectedVideo] = useState<VideoMetadata | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  async function createRun(input: RunInput) {
    try {
      if (onCreateRun) {
        await onCreateRun(input);
        return;
      }

      createLocalRun(input);
    } catch {
      setError("Could not create the run. Using a local demo run instead.");
      createLocalRun(input);
    } finally {
      setIsSubmitting(false);
    }
  }

  function createLocalRun(input: RunInput) {
    const slug = input.video?.fileName ?? input.episodeTitle;
    const localRunId = `local-${slug.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    window.localStorage.setItem(`clipcrew:${localRunId}`, JSON.stringify(input));
    router.push(`/runs/${localRunId}`);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setSelectedVideo(null);
      setSelectedFile(null);
      return;
    }

    const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    setSelectedFile(file);
    setUploadProgress(0);
    setUploadStatus("");
    setSelectedVideo({
      title: title.trim() || name || "Uploaded demo video",
      fileName: file.name,
      durationSeconds: 180,
      sourceType: "local_file_metadata",
      storageProvider: "local_demo",
      contentType: file.type,
      fileSize: file.size,
      uploadStatus: "pending",
    });
  }

  async function handleSampleSelect(index: number) {
    setError("");
    setIsSubmitting(true);
    await createRun(runInputFromVideo(sampleVideos[index]));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    if (!selectedVideo) {
      setError("Choose a local video file or select a sample library video.");
      setIsSubmitting(false);
      return;
    }

    let video = selectedVideo;

    if (selectedFile) {
      try {
        setUploadStatus("Requesting R2 upload URL...");
        const uploaded = await uploadVideoToR2(selectedFile, setUploadProgress);
        video = {
          ...selectedVideo,
          storageProvider: "r2",
          r2Key: uploaded.key,
          publicUrl: uploaded.publicUrl,
          contentType: selectedFile.type,
          fileSize: selectedFile.size,
          uploadStatus: "uploaded",
        };
        setSelectedVideo(video);
        setUploadStatus(`Uploaded to R2: ${uploaded.publicUrl}`);
      } catch {
        video = { ...selectedVideo, uploadStatus: "failed" };
        setSelectedVideo(video);
        setUploadStatus("R2 upload failed; continuing with local metadata.");
      }
    }

    const input: RunInput = {
      title: title.trim() || "Untitled Podcast",
      episodeTitle: episodeTitle.trim() || "Untitled Episode",
      sourceText: sampleTranscript,
      sourceType: video.sourceType,
      video,
    };

    await createRun(input);
  }

  return (
    <section className="rounded-[2rem] border border-white/15 bg-white/[0.08] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-7">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-200">
          Upload or choose video
        </p>
        <h2 className="text-2xl font-bold text-white">
          Start from the video library
        </h2>
        <p className="text-sm leading-6 text-zinc-300">
          Pick a sample video or choose a local file. The MVP stores metadata only,
          then uses the demo transcript fallback for scoring.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-200">
            Show or creator title
          </span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-white outline-none transition focus:border-teal-300"
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-200">
            Video or episode title
          </span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-white outline-none transition focus:border-teal-300"
            onChange={(event) => setEpisodeTitle(event.target.value)}
            value={episodeTitle}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-200">
            Upload video metadata
          </span>
          <input
            accept="video/*"
            className="w-full rounded-2xl border border-dashed border-white/15 bg-zinc-950/70 px-4 py-4 text-sm text-zinc-200 file:mr-4 file:rounded-full file:border-0 file:bg-teal-300 file:px-4 file:py-2 file:text-sm file:font-bold file:text-zinc-950"
            onChange={handleFileChange}
            type="file"
          />
        </label>

        {selectedVideo ? (
          <div className="rounded-2xl border border-teal-300/20 bg-teal-300/10 p-4 text-sm text-teal-50">
            Selected: {selectedVideo.fileName} · {selectedVideo.durationSeconds}s
            placeholder
            {selectedVideo.publicUrl ? (
              <a
                className="mt-2 block break-all text-teal-100 underline"
                href={selectedVideo.publicUrl}
                rel="noreferrer"
                target="_blank"
              >
                {selectedVideo.publicUrl}
              </a>
            ) : null}
          </div>
        ) : null}

        {uploadStatus ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 text-sm text-zinc-200">
            <p>{uploadStatus}</p>
            {uploadProgress > 0 ? (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-teal-300 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-200">Sample video library</p>
          {sampleVideos.map((video, index) => (
            <button
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-left transition hover:border-teal-300/50 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSubmitting}
              key={video.fileName}
              onClick={() => handleSampleSelect(index)}
              type="button"
            >
              <span className="block font-bold text-white">
                {video.episodeTitle}
              </span>
              <span className="mt-1 block text-sm text-zinc-400">
                {video.fileName} · {Math.round(video.durationSeconds / 60)} min
                sample
              </span>
            </button>
          ))}
        </div>

        <button
          className="w-full rounded-2xl bg-teal-300 px-5 py-4 text-base font-black text-zinc-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting
            ? "Creating run..."
            : "Generate Clip Plan from selected file"}
        </button>

        {error ? <p className="text-sm text-amber-200">{error}</p> : null}
        <p className="text-xs leading-5 text-zinc-400">
          {mode === "convex"
            ? "Convex is configured; this stores video metadata and creates a run."
            : "Convex URL is not configured; this stores metadata in local demo state."}
        </p>
      </form>
    </section>
  );
}

async function uploadVideoToR2(
  file: File,
  onProgress: (progress: number) => void,
) {
  const presignResponse = await fetch("/api/r2-presign", {
    body: JSON.stringify({
      contentType: file.type,
      filename: file.name,
      size: file.size,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!presignResponse.ok) {
    throw new Error("Could not create R2 upload URL");
  }

  const presign = (await presignResponse.json()) as {
    uploadUrl: string;
    key: string;
    publicUrl: string;
  };

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", presign.uploadUrl);
    request.setRequestHeader("content-type", file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onerror = () => reject(new Error("R2 upload failed"));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      reject(new Error("R2 upload failed"));
    };
    request.send(file);
  });

  return presign;
}
