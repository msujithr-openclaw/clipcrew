import { sampleTranscript } from "./sampleTranscript";
import type { RunInput, VideoMetadata } from "./types";

export type SampleVideo = VideoMetadata & {
  episodeTitle: string;
  transcript: string;
};

export const sampleVideos: SampleVideo[] = [
  {
    title: "Creator Growth Show",
    episodeTitle: "Why podcast clips need a story",
    fileName: "creator-growth-story-clip.mp4",
    durationSeconds: 312,
    sourceType: "sample_library",
    storageProvider: "sample",
    transcript: sampleTranscript,
  },
  {
    title: "Founder Notes",
    episodeTitle: "The moment the launch finally clicked",
    fileName: "founder-notes-launch-moment.mov",
    durationSeconds: 248,
    sourceType: "sample_library",
    storageProvider: "sample",
    transcript: sampleTranscript,
  },
  {
    title: "The Operator Podcast",
    episodeTitle: "A cleaner way to repurpose long-form video",
    fileName: "operator-podcast-repurpose-demo.mp4",
    durationSeconds: 405,
    sourceType: "sample_library",
    storageProvider: "sample",
    transcript: sampleTranscript,
  },
];

export function runInputFromVideo(video: SampleVideo): RunInput {
  return {
    title: video.title,
    episodeTitle: video.episodeTitle,
    sourceType: "sample_video",
    sourceText: video.transcript,
    video: {
      title: video.title,
      fileName: video.fileName,
      durationSeconds: video.durationSeconds,
      sourceType: video.sourceType,
      storageProvider: video.storageProvider,
    },
  };
}
