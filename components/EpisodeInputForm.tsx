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
const tabs = ["Your Videos", "Clips"] as const;

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
  const allRuns = useQuery(api.runs.listRuns);
  const [activeTab, setActiveTab] = useState<Tab>("Your Videos");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState<Id<"videos"> | null>(
    null,
  );
  const [lastUploadedVideo, setLastUploadedVideo] = useState<StoredVideo | null>(
    null,
  );
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
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

  useEffect(() => {
    if (!pendingUpload?.previewUrl) {
      return;
    }

    return () => URL.revokeObjectURL(pendingUpload.previewUrl);
  }, [pendingUpload?.previewUrl]);

  useEffect(() => {
    if (!isCreateOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsCreateOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCreateOpen]);

  function selectVideo(video: StoredVideo) {
    setCreateError("");
    setSelectedVideoId(video._id);
    setProjectName(video.title);
  }

  function openCreateModal(video?: StoredVideo) {
    setCreateError("");

    if (video) {
      selectVideo(video);
    }

    setIsCreateOpen(true);
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
      setUploadState("done");
      setUploadProgress(100);
      setPendingUpload(null);
    } catch {
      if (uploadToken.current !== token) {
        return;
      }

      setError("Upload failed. Check your connection and try again.");
      setUploadState("error");
      setPendingUpload(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");

    if (!selectedVideo || !selectedVideoId) {
      setCreateError("Select a video first.");
      return;
    }

    setIsSubmitting(true);
    const name = projectName.trim() || selectedVideo.title;

    try {
      await onCreateRun({
        title: name,
        episodeTitle: name,
        sourceType: "r2_video",
        sourceUrl: selectedVideo.publicUrl,
        videoId: selectedVideoId,
      });
    } catch {
      setCreateError("Could not create the clip project. Try again.");
    } finally {
      setIsSubmitting(false);
    }
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

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <label className="grid min-h-64 cursor-pointer place-items-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center transition hover:border-zinc-500 hover:bg-white">
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
                <div className="min-h-64 rounded-3xl border border-zinc-950 bg-zinc-950 p-4 text-left text-white">
                  <video
                    className="aspect-video w-full rounded-2xl bg-black object-cover"
                    muted
                    src={pendingUpload.previewUrl}
                  />
                  <p className="mt-3 truncate font-black">
                    {pendingUpload.fileName}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold">Uploading...</span>
                    <span className="text-zinc-400">{uploadProgress}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
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
                <div className="grid min-h-64 place-items-center rounded-3xl border border-zinc-200 bg-white p-5 text-center">
                  <div>
                    <p className="text-sm font-black">No videos yet</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Upload your first episode to start making clips.
                    </p>
                  </div>
                </div>
              ) : null}

              {videos.map((video) => (
                <div
                  className="flex min-h-64 flex-col rounded-3xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-400"
                  key={video._id}
                >
                  <video
                    className="aspect-video w-full rounded-2xl bg-zinc-100 object-cover"
                    muted
                    preload="metadata"
                    src={video.publicUrl}
                  />
                  <p className="mt-3 font-black">{video.title}</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {formatDuration(video.durationSeconds)} ·{" "}
                    {new Date(video.createdAt).toLocaleDateString()}
                  </p>
                  <button
                    className="mt-auto w-full rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSubmitting}
                    onClick={() => openCreateModal(video)}
                    type="button"
                  >
                    Create clips
                  </button>
                </div>
              ))}
            </div>
            {error ? <p className="mt-4 text-sm text-amber-700">{error}</p> : null}
          </section>
        ) : null}

        {activeTab === "Clips" ? (
          <section className="min-h-screen bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
                  Clips
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                  Clip projects
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
                  Every clip project for your episodes, newest first.
                </p>
              </div>
              <button
                className="rounded-2xl bg-zinc-950 px-5 py-4 text-sm font-black text-white transition hover:bg-zinc-800"
                onClick={() => openCreateModal()}
                type="button"
              >
                Create clips
              </button>
            </div>

            <div className="mt-6 grid gap-3">
              {allRuns === undefined ? (
                <p className="rounded-3xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                  Loading clip projects...
                </p>
              ) : null}

              {allRuns?.length === 0 ? (
                <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-center">
                  <p className="text-sm font-black">No clip projects yet</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Create one from an uploaded episode.
                  </p>
                </div>
              ) : null}

              {allRuns?.map((run) => (
                <button
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-zinc-400 hover:bg-white"
                  key={run._id}
                  onClick={() => router.push(`/runs/${run._id}`)}
                  type="button"
                >
                  <span>
                    <span className="block font-black">{run.episodeTitle}</span>
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
          </section>
        ) : null}
      </div>

      {isCreateOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4"
          onClick={() => setIsCreateOpen(false)}
        >
          <form
            aria-modal="true"
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleSubmit}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
                  New clip project
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  Select a video
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  We&apos;ll transcribe the episode, find the best moments, and
                  prepare short clips for your review.
                </p>
              </div>
              <button
                aria-label="Close"
                className="rounded-full border border-zinc-200 px-3 py-1 text-sm font-black text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-950"
                onClick={() => setIsCreateOpen(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {videos.length === 0 ? (
                <p className="col-span-full rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-500">
                  No videos yet. Upload an episode first.
                </p>
              ) : null}

              {videos.map((video) => {
                const active = selectedVideoId === video._id;

                return (
                  <button
                    className={`rounded-2xl border p-3 text-left transition ${
                      active
                        ? "border-zinc-950 bg-zinc-950 text-white"
                        : "border-zinc-200 bg-white hover:border-zinc-400"
                    }`}
                    key={video._id}
                    onClick={() => selectVideo(video)}
                    type="button"
                  >
                    <video
                      className="aspect-video w-full rounded-xl bg-zinc-100 object-cover"
                      muted
                      preload="metadata"
                      src={video.publicUrl}
                    />
                    <span className="mt-2 block text-sm font-black">
                      {video.title}
                    </span>
                    <span className="mt-1 block text-xs opacity-70">
                      {formatDuration(video.durationSeconds)}
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="mt-5 block space-y-2">
              <span className="text-sm font-semibold text-zinc-700">
                Clip project name
              </span>
              <input
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none transition focus:border-zinc-950 focus:bg-white"
                onChange={(event) => setProjectName(event.target.value)}
                value={projectName}
              />
            </label>

            {createError ? (
              <p className="mt-4 text-sm text-amber-700">{createError}</p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button
                className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-black text-zinc-700 transition hover:border-zinc-500"
                onClick={() => setIsCreateOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting || isUploading || !selectedVideo}
                type="submit"
              >
                {isSubmitting ? "Creating project..." : "Generate clips"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
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
