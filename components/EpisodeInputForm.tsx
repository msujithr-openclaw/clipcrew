"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { ChangeEvent, FormEvent } from "react";
import { formatDuration, runStatusLabel } from "@/lib/workflow/labels";
import type { RunInput, VideoMetadata } from "@/lib/workflow/types";

const hasConvexUrl = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
const tabs = ["Your Videos", "Create Clips"] as const;

type Tab = (typeof tabs)[number];
type StoredVideo = Doc<"videos">;
type UploadState = "idle" | "uploading" | "done" | "error";
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
          App configuration required
        </h1>
        <p className="mt-4 text-sm leading-6 text-zinc-500">
          `NEXT_PUBLIC_CONVEX_URL` is required before ClipCrew can store videos
          and clip projects.
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
      () => reject(new Error("Clip project creation timed out")),
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
  const [activeTab, setActiveTab] = useState<Tab>("Your Videos");
  const [projectName, setProjectName] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState<Id<"videos"> | null>(
    null,
  );
  const [lastUploadedVideo, setLastUploadedVideo] = useState<StoredVideo | null>(
    null,
  );
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadToken = useRef(0);
  const isUploading = uploadState === "uploading";

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
    setProjectName(video.title);
    setPendingUpload(null);
  }

  async function createRun(input: RunInput) {
    try {
      await onCreateRun(input);
    } catch {
      setError("Could not create the clip project. Try again.");
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
    setUploadState("uploading");
    setUploadProgress(0);
    setPendingUpload({ fileName: file.name, fileSize: file.size, previewUrl });
    setProjectName(name || file.name);

    try {
      const [durationSeconds, uploaded] = await Promise.all([
        readVideoDuration(previewUrl),
        uploadVideoToR2(file, setUploadProgress),
      ]);

      if (uploadToken.current !== token) {
        return;
      }

      const video = {
        title: name || file.name,
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
      setUploadState("done");
      setUploadProgress(100);
      setPendingUpload(null);
    } catch {
      if (uploadToken.current !== token) {
        return;
      }

      setError("Upload failed. Check your connection and try again.");
      setUploadState("error");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    if (!selectedVideo || !selectedVideoId) {
      setError("Select a video first.");
      setIsSubmitting(false);
      return;
    }

    if (isUploading) {
      setError("Wait for the upload to finish before generating clips.");
      setIsSubmitting(false);
      return;
    }

    const name = projectName.trim() || selectedVideo.title;

    await createRun({
      title: name,
      episodeTitle: name,
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
        {activeTab === "Your Videos" ? (
          <section className="min-h-screen bg-white p-5 sm:p-7">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
                Video Library
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                Your videos
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
                Upload a podcast episode to get started.
              </p>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_340px]">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="grid min-h-56 cursor-pointer place-items-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center transition hover:border-zinc-500 hover:bg-white">
                  <span>
                    <span className="block text-4xl font-black text-zinc-950">+</span>
                    <span className="mt-3 block text-sm font-black">
                      Upload episode
                    </span>
                    <span className="mt-1 block text-sm text-zinc-500">
                      MP4, MOV, or audio files.
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
                      {formatFileSize(pendingUpload.fileSize)}
                    </p>
                  </div>
                ) : null}

                {storedVideos === undefined ? (
                  <p className="rounded-3xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                    Loading videos...
                  </p>
                ) : null}

                {storedVideos !== undefined &&
                videos.length === 0 &&
                !pendingUpload ? (
                  <div className="grid min-h-56 place-items-center rounded-3xl border border-zinc-200 bg-white p-5 text-center">
                    <div>
                      <p className="text-sm font-black">No videos yet</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        Upload your first episode to start making clips.
                      </p>
                    </div>
                  </div>
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
                        {formatDuration(video.durationSeconds)}
                        {video.fileName !== video.title
                          ? ` · ${video.fileName}`
                          : ""}
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
                  {selectedVideo?.title ??
                    pendingUpload?.fileName ??
                    "Upload an episode"}
                </p>
                {selectedVideo ? (
                  <p className="mt-1 text-sm text-zinc-400">
                    {formatDuration(selectedVideo.durationSeconds)}
                    {selectedVideo.fileSize
                      ? ` · ${formatFileSize(selectedVideo.fileSize)}`
                      : ""}
                    {" · "}
                    {new Date(selectedVideo.createdAt).toLocaleDateString()}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-zinc-400">
                    Your episodes stay in your library, ready for clips.
                  </p>
                )}

                {uploadState !== "idle" ? (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold">
                        {uploadState === "uploading"
                          ? "Uploading..."
                          : uploadState === "done"
                            ? "Upload complete"
                            : "Upload failed"}
                      </span>
                      {uploadState === "uploading" ? (
                        <span className="text-zinc-400">{uploadProgress}%</span>
                      ) : null}
                    </div>
                    {uploadState === "error" ? (
                      <p className="mt-2 text-sm text-zinc-400">
                        Check your connection and try again.
                      </p>
                    ) : null}
                    {uploadState !== "error" ? (
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-white transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {selectedVideo && !isUploading ? (
                  <button
                    className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200"
                    onClick={() => setActiveTab("Create Clips")}
                    type="button"
                  >
                    Create clips from this video
                  </button>
                ) : null}
              </div>
            </div>
            {error ? <p className="mt-4 text-sm text-amber-700">{error}</p> : null}
          </section>
        ) : null}

        {activeTab === "Create Clips" ? (
          <form
            className="min-h-screen bg-white p-5 sm:p-7"
            onSubmit={handleSubmit}
          >
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
              Create Clips
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              {selectedVideo ? "Create a clip project" : "Select a video to start"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              We&apos;ll transcribe the episode, find the best moments, and
              prepare short clips for your review.
            </p>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                {selectedVideo ? (
                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
                      Selected video
                    </p>
                    <video
                      className="mt-3 aspect-video w-full max-w-md rounded-2xl bg-black object-cover"
                      muted
                      src={selectedVideo.publicUrl}
                    />
                    <p className="mt-3 text-xl font-black">{selectedVideo.title}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {formatDuration(selectedVideo.durationSeconds)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
                      Selected video
                    </p>
                    <p className="mt-3 text-sm text-zinc-500">
                      Pick an episode from your library first.
                    </p>
                    <button
                      className="mt-4 rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:border-zinc-500"
                      onClick={() => setActiveTab("Your Videos")}
                      type="button"
                    >
                      Go to your videos
                    </button>
                  </div>
                )}

                <div className="rounded-3xl border border-zinc-200 bg-white p-4">
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
                    Clip projects for this video
                  </p>
                  <div className="mt-4 grid gap-3">
                    {selectedVideoRuns === undefined && selectedVideoId ? (
                      <p className="text-sm text-zinc-500">Loading projects...</p>
                    ) : null}
                    {selectedVideoRuns?.length === 0 ? (
                      <p className="text-sm text-zinc-500">
                        No clip projects yet for this video.
                      </p>
                    ) : null}
                    {selectedVideoRuns?.map((run) => (
                      <button
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-zinc-400 hover:bg-white"
                        key={run._id}
                        onClick={() => router.push(`/runs/${run._id}`)}
                        type="button"
                      >
                        <span>
                          <span className="block font-black">
                            {run.episodeTitle}
                          </span>
                          <span className="mt-1 block text-sm text-zinc-500">
                            {runStatusLabel(run.status)} ·{" "}
                            {new Date(run.createdAt).toLocaleString()}
                          </span>
                        </span>
                        <span className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-bold text-white">
                          Open
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white p-4">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
                  New clip project
                </p>
                <div className="mt-4 grid gap-4">
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-zinc-700">
                      Clip project name
                    </span>
                    <input
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none transition focus:border-zinc-950 focus:bg-white"
                      onChange={(event) => setProjectName(event.target.value)}
                      value={projectName}
                    />
                  </label>

                  <p className="text-sm leading-6 text-zinc-500">
                    You&apos;ll review every suggested clip before anything is
                    exported.
                  </p>
                  <button
                    className="rounded-2xl bg-zinc-950 px-5 py-4 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSubmitting || isUploading || !selectedVideo}
                    type="submit"
                  >
                    {isUploading
                      ? "Uploading video..."
                      : isSubmitting
                        ? "Creating project..."
                        : "Generate clips"}
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

function formatFileSize(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;
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
    throw new Error("Could not create upload URL");
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
    request.onerror = () => reject(new Error("Upload failed"));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      reject(new Error("Upload failed"));
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
