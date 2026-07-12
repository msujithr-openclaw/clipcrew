"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { sampleTranscript } from "@/lib/workflow/sampleTranscript";
import { sampleVideos } from "@/lib/workflow/sampleVideos";
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
    "Why podcast clips need a story",
  );
  const [selectedVideo, setSelectedVideo] = useState<VideoMetadata | null>(
    sampleVideos[0],
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("Ready: sample video selected");
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (!localPreviewUrl) {
      return;
    }

    return () => URL.revokeObjectURL(localPreviewUrl);
  }, [localPreviewUrl]);

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
      setSelectedVideo(sampleVideos[0]);
      setSelectedFile(null);
      setLocalPreviewUrl("");
      setUploadStatus("Ready: sample video selected");
      return;
    }

    const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    setSelectedFile(file);
    setLocalPreviewUrl(URL.createObjectURL(file));
    setUploadProgress(0);
    setUploadStatus("Local file staged. R2 upload starts when you generate clips.");
    setEpisodeTitle(name || "Uploaded demo video");
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

  function handleSampleSelect(index: number) {
    const video = sampleVideos[index];
    setError("");
    setSelectedFile(null);
    setLocalPreviewUrl("");
    setTitle(video.title);
    setEpisodeTitle(video.episodeTitle);
    setSelectedVideo(video);
    setUploadProgress(0);
    setUploadStatus("Ready: sample video selected");
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
        setUploadStatus("Uploaded to R2. Creating run...");
      } catch {
        video = { ...selectedVideo, uploadStatus: "failed" };
        setSelectedVideo(video);
        setUploadStatus("R2 upload failed; continuing with local metadata.");
      }
    }

    await createRun({
      title: title.trim() || "Untitled Podcast",
      episodeTitle: episodeTitle.trim() || "Untitled Episode",
      sourceText: sampleTranscript,
      sourceType: video.sourceType,
      video,
    });
  }

  const previewUrl = selectedVideo?.publicUrl ?? localPreviewUrl;

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-4 lg:flex-row lg:p-6">
      <aside className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm lg:w-64">
        <div className="mb-8">
          <p className="text-xl font-black tracking-tight">ClipCrew</p>
          <p className="mt-1 text-sm text-zinc-500">
            AI social media agency for podcasters.
          </p>
        </div>
        <nav className="grid gap-2 text-sm font-semibold text-zinc-600">
          {[
            "Video Library",
            "Generate Clips",
            "Runs",
            "History",
          ].map((item, index) => (
            <a
              className={`rounded-2xl px-4 py-3 transition hover:bg-zinc-100 ${
                index === 0 ? "bg-zinc-950 text-white" : ""
              }`}
              href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
              key={item}
            >
              {item}
            </a>
          ))}
        </nav>
      </aside>

      <form className="flex-1 space-y-4" onSubmit={handleSubmit}>
        <section
          className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm sm:p-7"
          id="video-library"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
                Video Library
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                Select a video, generate clips.
              </h1>
            </div>
            <span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
              {mode === "convex" ? "Convex connected" : "Local fallback"}
            </span>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-zinc-700">
                  Show or creator title
                </span>
                <input
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none transition focus:border-zinc-950 focus:bg-white"
                  onChange={(event) => setTitle(event.target.value)}
                  value={title}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-zinc-700">
                  Video or episode title
                </span>
                <input
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none transition focus:border-zinc-950 focus:bg-white"
                  onChange={(event) => setEpisodeTitle(event.target.value)}
                  value={episodeTitle}
                />
              </label>

              <label className="block rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-5">
                <span className="block text-sm font-semibold text-zinc-700">
                  Upload new video
                </span>
                <span className="mt-1 block text-sm text-zinc-500">
                  Upload lives in Video Library. R2 starts when you generate.
                </span>
                <input
                  accept="video/*"
                  className="mt-4 w-full text-sm text-zinc-600 file:mr-4 file:rounded-full file:border-0 file:bg-zinc-950 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
                  onChange={handleFileChange}
                  type="file"
                />
              </label>

              <div className="rounded-3xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-zinc-700">R2 upload status</span>
                  <span className="text-zinc-500">{uploadProgress}%</span>
                </div>
                <p className="mt-2 break-all text-sm text-zinc-500">{uploadStatus}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-zinc-950 transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-zinc-950 p-4 text-white">
              {previewUrl ? (
                <video
                  className="aspect-video w-full rounded-2xl bg-black object-cover"
                  controls
                  src={previewUrl}
                />
              ) : (
                <div className="grid aspect-video place-items-center rounded-2xl bg-[radial-gradient(circle_at_30%_20%,#facc15,transparent_30%),linear-gradient(135deg,#18181b,#3f3f46)] p-6 text-center">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.22em] text-zinc-300">
                      Sample preview
                    </p>
                    <p className="mt-3 text-2xl font-black">
                      {selectedVideo?.fileName ?? "No video selected"}
                    </p>
                  </div>
                </div>
              )}
              <div className="mt-4">
                <p className="font-bold">{episodeTitle}</p>
                <p className="mt-1 text-sm text-zinc-400">
                  {selectedVideo
                    ? `${selectedVideo.fileName} · ${Math.round(
                        selectedVideo.durationSeconds / 60,
                      )} min`
                    : "Select or upload a video"}
                </p>
                {selectedVideo?.publicUrl ? (
                  <a
                    className="mt-3 block break-all text-sm text-zinc-300 underline"
                    href={selectedVideo.publicUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {selectedVideo.publicUrl}
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {sampleVideos.map((video, index) => {
              const active = selectedVideo?.fileName === video.fileName;

              return (
                <button
                  className={`rounded-3xl border p-4 text-left transition ${
                    active
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-zinc-50 hover:border-zinc-400"
                  }`}
                  disabled={isSubmitting}
                  key={video.fileName}
                  onClick={() => handleSampleSelect(index)}
                  type="button"
                >
                  <span className="block text-xs font-bold uppercase tracking-[0.18em] opacity-60">
                    Sample video
                  </span>
                  <span className="mt-3 block font-black">{video.episodeTitle}</span>
                  <span className="mt-2 block text-sm opacity-70">
                    {video.fileName} · {Math.round(video.durationSeconds / 60)} min
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section
          className="grid gap-4 lg:grid-cols-[1fr_0.8fr]"
          id="generate-clips"
        >
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
              Generate Clips
            </p>
            {selectedVideo ? (
              <>
                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  Ready to score {selectedVideo.fileName}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  This creates the Convex/local run and keeps using the sample
                  transcript fallback for the workflow trace.
                </p>
                <button
                  className="mt-5 rounded-2xl bg-zinc-950 px-5 py-4 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Creating run..." : "Generate Clip Plan"}
                </button>
              </>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">
                Select a sample video or upload a local file first.
              </p>
            )}
            {error ? <p className="mt-4 text-sm text-amber-700">{error}</p> : null}
          </div>

          <div className="grid gap-4" id="runs">
            <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
                Runs
              </p>
              <p className="mt-3 text-sm text-zinc-500">
                New runs open on their trace page after generation.
              </p>
            </div>
            <div
              className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm"
              id="history"
            >
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
                History
              </p>
              <p className="mt-3 text-sm text-zinc-500">
                Demo history stays minimal for now: use generated run URLs.
              </p>
            </div>
          </div>
        </section>
      </form>
    </div>
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
