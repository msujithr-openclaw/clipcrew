"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { ChangeEvent, FormEvent } from "react";
import type { RunInput, VideoMetadata } from "@/lib/workflow/types";

const hasConvexUrl = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
const tabs = ["Video Library", "Generate Clips"] as const;

type Tab = (typeof tabs)[number];
type StoredVideo = Doc<"videos">;
type PendingUpload = {
  fileName: string;
  fileSize: number;
  previewUrl: string;
};

export function EpisodeInputForm() {
  if (!hasConvexUrl) {
    return <SetupRequired />;
  }

  return <ConvexRunForm />;
}

function SetupRequired() {
  return (
    <section className="mx-auto max-w-3xl p-6">
      <div className="rounded-[2rem] border border-zinc-200 bg-white p-7 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
          Setup required
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          Connect Convex before using ClipCrew
        </h1>
        <p className="mt-4 text-sm leading-6 text-zinc-500">
          `NEXT_PUBLIC_CONVEX_URL` is required to create and view runs.
        </p>
      </div>
    </section>
  );
}

function ConvexRunForm() {
  const createRun = useMutation(api.runs.createRun);
  const router = useRouter();

  return (
    <RunForm
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
  onCreateRun,
}: {
  onCreateRun: (input: RunInput) => Promise<void>;
}) {
  const router = useRouter();
  const addVideo = useMutation(api.runs.addVideo);
  const storedVideos = useQuery(api.runs.listVideos);
  const [activeTab, setActiveTab] = useState<Tab>("Video Library");
  const [title, setTitle] = useState("");
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState<Id<"videos"> | null>(
    null,
  );
  const [lastUploadedVideo, setLastUploadedVideo] = useState<StoredVideo | null>(
    null,
  );
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("Ready for R2 upload");
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadToken = useRef(0);

  const videos = useMemo(
    () =>
      lastUploadedVideo &&
      !storedVideos?.some((video) => video._id === lastUploadedVideo._id)
        ? [lastUploadedVideo, ...(storedVideos ?? [])]
        : (storedVideos ?? []),
    [lastUploadedVideo, storedVideos],
  );
  const selectedVideo =
    videos.find((video) => video._id === selectedVideoId) ?? null;
  const selectedVideoRuns = useQuery(
    api.runs.listByVideo,
    selectedVideoId ? { videoId: selectedVideoId } : "skip",
  );
  const previewUrl = pendingUpload?.previewUrl ?? selectedVideo?.publicUrl ?? "";

  useEffect(() => {
    if (selectedVideoId || !videos[0]) {
      return;
    }

    selectVideo(videos[0]);
  }, [selectedVideoId, videos]);

  useEffect(() => {
    if (!pendingUpload?.previewUrl) {
      return;
    }

    return () => URL.revokeObjectURL(pendingUpload.previewUrl);
  }, [pendingUpload?.previewUrl]);

  function selectVideo(video: StoredVideo) {
    setError("");
    setSelectedVideoId(video._id);
    setTitle(video.title);
    setEpisodeTitle(video.fileName.replace(/\.[^.]+$/, ""));
    setPendingUpload(null);
    setUploadStatus("R2 video selected");
    setUploadProgress(100);
  }

  async function createRun(input: RunInput) {
    try {
      await onCreateRun(input);
    } catch {
      setError("Could not create the Convex run.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const token = uploadToken.current + 1;
    const previewUrl = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    uploadToken.current = token;
    setError("");
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus("Uploading to R2...");
    setPendingUpload({ fileName: file.name, fileSize: file.size, previewUrl });
    setTitle((current) => current || name);
    setEpisodeTitle(name || file.name);

    try {
      const [durationSeconds, uploaded] = await Promise.all([
        readVideoDuration(previewUrl),
        uploadVideoToR2(file, setUploadProgress),
      ]);

      if (uploadToken.current !== token) {
        return;
      }

      const video = {
        title: title.trim() || name || file.name,
        fileName: file.name,
        durationSeconds,
        sourceType: "r2_upload",
        storageProvider: "r2",
        r2Key: uploaded.key,
        publicUrl: uploaded.publicUrl,
        contentType: file.type,
        fileSize: file.size,
        uploadStatus: "uploaded",
      } satisfies VideoMetadata;
      const videoId = await addVideo(video);

      if (uploadToken.current !== token) {
        return;
      }

      const storedVideo = {
        ...video,
        _id: videoId,
        _creationTime: Date.now(),
        createdAt: Date.now(),
      } satisfies StoredVideo;
      setLastUploadedVideo(storedVideo);
      setSelectedVideoId(videoId);
      setUploadStatus("Uploaded to R2 and saved to library");
      setUploadProgress(100);
      setPendingUpload(null);
    } catch {
      if (uploadToken.current !== token) {
        return;
      }

      setError("R2 upload failed. Fix storage configuration and upload again.");
      setUploadStatus("R2 upload failed");
    } finally {
      if (uploadToken.current === token) {
        setIsUploading(false);
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    if (!selectedVideo || !selectedVideoId) {
      setError("Upload or select an R2 video first.");
      setIsSubmitting(false);
      return;
    }

    if (isUploading) {
      setError("Wait for the R2 upload to finish before generating clips.");
      setIsSubmitting(false);
      return;
    }

    await createRun({
      title: title.trim() || selectedVideo.title,
      episodeTitle: episodeTitle.trim() || selectedVideo.fileName,
      sourceType: "r2_video",
      sourceUrl: selectedVideo.publicUrl,
      videoId: selectedVideoId,
    });
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-white lg:flex-row">
      <aside className="border-b border-zinc-200 bg-white p-5 lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
        <div className="mb-8">
          <p className="text-xl font-black tracking-tight">ClipCrew</p>
          <p className="mt-1 text-sm text-zinc-500">
            AI social media agency for podcasters.
          </p>
        </div>
        <nav className="grid gap-2 text-sm font-semibold text-zinc-600">
          {tabs.map((tab) => (
            <button
              aria-pressed={activeTab === tab}
              className={`rounded-2xl px-4 py-3 text-left transition hover:bg-zinc-100 ${
                activeTab === tab ? "bg-zinc-950 text-white" : ""
              }`}
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 bg-white">
        {activeTab === "Video Library" ? (
          <section className="min-h-screen bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
                  Video Library
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                  R2 video gallery
                </h1>
              </div>
              <span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
                Convex + R2
              </span>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_340px]">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="grid min-h-56 cursor-pointer place-items-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center transition hover:border-zinc-500 hover:bg-white">
                  <span>
                    <span className="block text-4xl font-black text-zinc-950">+</span>
                    <span className="mt-3 block text-sm font-black">
                      Add video
                    </span>
                    <span className="mt-1 block text-sm text-zinc-500">
                      Uploads to R2 and saves to Convex.
                    </span>
                  </span>
                  <input
                    accept="video/*"
                    className="sr-only"
                    onChange={handleFileChange}
                    type="file"
                  />
                </label>

                {pendingUpload ? (
                  <div className="min-h-56 rounded-3xl border border-zinc-950 bg-zinc-950 p-4 text-left text-white">
                    <video
                      className="aspect-video w-full rounded-2xl bg-black object-cover"
                      muted
                      src={pendingUpload.previewUrl}
                    />
                    <p className="mt-3 font-black">{pendingUpload.fileName}</p>
                    <p className="mt-2 text-sm opacity-70">
                      {Math.round(pendingUpload.fileSize / 1024 / 1024)} MB
                    </p>
                  </div>
                ) : null}

                {storedVideos === undefined ? (
                  <p className="rounded-3xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                    Loading videos...
                  </p>
                ) : null}

                {videos.map((video) => {
                  const active = selectedVideoId === video._id;

                  return (
                    <button
                      className={`min-h-56 rounded-3xl border p-4 text-left transition ${
                        active
                          ? "border-zinc-950 bg-zinc-950 text-white"
                          : "border-zinc-200 bg-white hover:border-zinc-400"
                      }`}
                      disabled={isSubmitting || isUploading}
                      key={video._id}
                      onClick={() => selectVideo(video)}
                      type="button"
                    >
                      <span className="grid aspect-video place-items-center overflow-hidden rounded-2xl bg-zinc-100">
                        <video
                          className="size-full object-cover"
                          muted
                          src={video.publicUrl}
                        />
                      </span>
                      <span className="mt-3 block font-black">{video.title}</span>
                      <span className="mt-2 block text-sm opacity-70">
                        {video.fileName} · {Math.round(video.durationSeconds / 60)} min
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-3xl bg-zinc-950 p-4 text-white">
                {previewUrl ? (
                  <video
                    className="aspect-video w-full rounded-2xl bg-black object-cover"
                    controls
                    src={previewUrl}
                  />
                ) : (
                  <div className="grid aspect-video place-items-center rounded-2xl bg-zinc-900 p-6 text-center">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.22em] text-zinc-400">
                        Selected
                      </p>
                      <p className="mt-3 text-2xl font-black">No video selected</p>
                    </div>
                  </div>
                )}
                <p className="mt-4 font-bold">
                  {selectedVideo?.title ?? pendingUpload?.fileName ?? "Add a video"}
                </p>
                <p className="mt-1 break-all text-sm text-zinc-400">
                  {selectedVideo?.publicUrl ?? "Upload a video to store it in R2"}
                </p>
                <div className="mt-4 border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold">Upload status</span>
                    <span className="text-zinc-400">{uploadProgress}%</span>
                  </div>
                  <p className="mt-2 break-all text-sm text-zinc-400">
                    {uploadStatus}
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
            {error ? <p className="mt-4 text-sm text-amber-700">{error}</p> : null}
          </section>
        ) : null}

        {activeTab === "Generate Clips" ? (
          <form
            className="min-h-screen bg-white p-5 sm:p-7"
            onSubmit={handleSubmit}
          >
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
              Video -&gt; Job -&gt; Review -&gt; Export
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              {selectedVideo
                ? "Create a clip-generation job"
                : "Select an R2 video to start"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              Select a stored R2 video, create or open a job, review suggested
              clips, then export approved clips.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <div
                className={`rounded-2xl border p-4 ${
                  selectedVideo
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-zinc-200 bg-zinc-50"
                }`}
              >
                <p className="text-sm font-black">1 Video</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {selectedVideo ? "R2 video selected" : "Choose a stored video"}
                </p>
              </div>
              <div
                className={`rounded-2xl border p-4 ${
                  selectedVideo
                    ? "border-zinc-950 bg-white"
                    : "border-zinc-200 bg-zinc-50"
                }`}
              >
                <p className="text-sm font-black">2 Job</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {isSubmitting ? "Creating Convex run" : "Create or open a job"}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-black">3 Review</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Approve suggested clips
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-black">4 Export</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Generate approved clips
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                {selectedVideo ? (
                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
                      1. Video
                    </p>
                    <p className="mt-3 text-xl font-black">{selectedVideo.title}</p>
                    <p className="mt-1 break-all text-sm text-zinc-500">
                      {selectedVideo.fileName}
                    </p>
                    <p className="mt-3 text-sm text-zinc-500">
                      Stored in R2 and ready for job creation.
                    </p>
                  </div>
                ) : null}

                <div className="rounded-3xl border border-zinc-200 bg-white p-4">
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
                    Existing jobs for this video
                  </p>
                  <div className="mt-4 grid gap-3">
                    {selectedVideoRuns === undefined && selectedVideoId ? (
                      <p className="text-sm text-zinc-500">Loading jobs...</p>
                    ) : null}
                    {selectedVideoRuns?.length === 0 ? (
                      <p className="text-sm text-zinc-500">
                        No jobs yet for this video.
                      </p>
                    ) : null}
                    {selectedVideoRuns?.map((run) => (
                      <button
                        className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-zinc-400 hover:bg-white"
                        key={run._id}
                        onClick={() => router.push(`/runs/${run._id}`)}
                        type="button"
                      >
                        <span className="block font-black">{run.episodeTitle}</span>
                        <span className="mt-1 block text-sm text-zinc-500">
                          Open workflow · {run.status} ·{" "}
                          {new Date(run.createdAt).toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white p-4">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
                  2. Create job
                </p>
                <div className="mt-4 grid gap-4">
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
                      Job or episode title
                    </span>
                    <input
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none transition focus:border-zinc-950 focus:bg-white"
                      onChange={(event) => setEpisodeTitle(event.target.value)}
                      value={episodeTitle}
                    />
                  </label>

                  <p className="text-sm leading-6 text-zinc-500">
                    This creates a Convex run for the selected video and opens the
                    job page for review and export.
                  </p>
                  <button
                    className="rounded-2xl bg-zinc-950 px-5 py-4 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSubmitting || isUploading || !selectedVideo}
                    type="submit"
                  >
                    {isUploading
                      ? "Uploading video..."
                      : isSubmitting
                        ? "Creating job..."
                        : "Create job & open workflow"}
                  </button>
                </div>
              </div>
            </div>

            {error ? <p className="mt-4 text-sm text-amber-700">{error}</p> : null}
          </form>
        ) : null}
      </div>
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

async function readVideoDuration(previewUrl: string) {
  return await new Promise<number>((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => resolve(Math.round(video.duration) || 0);
    video.onerror = () => resolve(0);
    video.src = previewUrl;
  });
}
