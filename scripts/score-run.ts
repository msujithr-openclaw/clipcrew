import { ConvexHttpClient } from "convex/browser";
import OpenAI from "openai";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

type Word = {
  word: string;
  start: number;
  end: number;
};

type Candidate = {
  title: string;
  startTime: string;
  endTime: string;
  transcript: string;
  hook: number;
  clarity: number;
  emotion: number;
  novelty: number;
  shareability: number;
  totalScore: number;
  reason: string;
  status: "suggested";
};

type CandidateWindow = {
  id: number;
  startTime: string;
  endTime: string;
  transcript: string;
  rankScore: number;
};

const runId = process.argv[2] as Id<"runs"> | undefined;

if (!runId) {
  console.error("Usage: bun scripts/score-run.ts <runId>");
  process.exit(1);
}

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.error("NEXT_PUBLIC_CONVEX_URL is not configured.");
  process.exit(1);
}

const convexDeploymentUrl = convexUrl;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  console.error("OPENAI_API_KEY is not configured.");
  process.exit(1);
}

await scoreRun(runId);

async function scoreRun(targetRunId: Id<"runs">) {
  const client = new ConvexHttpClient(convexDeploymentUrl);
  const openai = new OpenAI({ apiKey: openaiApiKey });
  const run = await client.query(api.runs.getRun, { runId: targetRunId });

  if (!run) {
    throw new Error(`Run not found: ${targetRunId}`);
  }

  if (!run.sourceText.trim()) {
    throw new Error("Run must be transcribed before scoring.");
  }

  const chunks = await client.query(api.runs.listTranscriptionChunks, {
    runId: targetRunId,
  });
  const words = chunks
    .flatMap((chunk) => wordsFromPayload(chunk.payload))
    .sort((a, b) => a.start - b.start);
  const scorerStepId = await client.mutation(api.workflow.addStep, {
    runId: targetRunId,
    role: "moment_scorer",
    status: "running",
    order: 3,
    inputSummary: `Transcript with ${words.length || run.sourceText.split(/\s+/).length} timed words.`,
    outputSummary: "Scoring reel candidates.",
  });

  try {
    const windows = words.length
      ? candidateWindowsFromWords(words)
      : candidateWindowsFromText(run.sourceText);
    const candidates = await scoreCandidatesWithOpenAI(openai, windows);

    await client.mutation(api.candidates.clearByRun, { runId: targetRunId });
    await client.mutation(api.candidates.addMany, {
      runId: targetRunId,
      candidates,
    });
    await client.mutation(api.workflow.updateStep, {
      stepId: scorerStepId,
      status: "completed",
      outputSummary: `Identified ${candidates.length} candidate reel moments.`,
      completedAt: Date.now(),
    });
    await client.mutation(api.runs.updateRunStatus, {
      runId: targetRunId,
      status: "scored",
    });

    console.log(`Scored ${targetRunId}: ${candidates.length} candidates.`);
  } catch (error) {
    await client.mutation(api.workflow.updateStep, {
      stepId: scorerStepId,
      status: "failed",
      outputSummary:
        error instanceof Error ? error.message : "Candidate scoring failed.",
      completedAt: Date.now(),
    });
    await client.mutation(api.runs.updateRunStatus, {
      runId: targetRunId,
      status: "failed",
      completedAt: Date.now(),
    });
    throw error;
  }
}

function candidateWindowsFromWords(words: Word[]) {
  const windows: CandidateWindow[] = [];

  for (let start = 0; start < words.length; start += 90) {
    const startTime = words[start]?.start ?? 0;
    const endTarget = startTime + 75;
    const end = words.findIndex(
      (word, index) => index > start && word.end >= endTarget,
    );
    const slice = words.slice(start, end === -1 ? start + 170 : end + 1);

    if (slice.length < 45) {
      continue;
    }

    windows.push(buildWindow(slice, windows.length));
  }

  return windows
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 24)
    .map((window, index) => ({ ...window, id: index + 1 }));
}

function candidateWindowsFromText(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const fakeWords = words.map((word, index) => ({
    word,
    start: index * 0.4,
    end: index * 0.4 + 0.4,
  }));

  return candidateWindowsFromWords(fakeWords);
}

function buildWindow(words: Word[], index: number): CandidateWindow {
  const transcript = cleanText(words.map((word) => word.word).join(" "));
  const lower = transcript.toLowerCase();
  const hook = score(lower, ["why", "how", "what", "future", "breakthrough", "important"]);
  const clarity = Math.min(5, Math.max(3, Math.round(words.length / 35)));
  const emotion = score(lower, ["believe", "excited", "scary", "hope", "important", "amazing"]);
  const novelty = score(lower, ["new", "first", "reinvent", "revolution", "future", "robot"]);
  const shareability = score(lower, ["ai", "future", "superhuman", "technology", "computer", "robot"]);

  return {
    id: index + 1,
    startTime: formatTime(words[0]?.start ?? 0),
    endTime: formatTime(words.at(-1)?.end ?? words[0]?.end ?? 0),
    transcript,
    rankScore: hook + clarity + emotion + novelty + shareability,
  };
}

async function scoreCandidatesWithOpenAI(
  openai: OpenAI,
  windows: CandidateWindow[],
) {
  if (!windows.length) {
    throw new Error("No transcript windows available for scoring.");
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5.5",
    messages: [
      {
        role: "system",
        content:
          "You select short-form podcast/video reel candidates. Return only valid JSON matching the requested schema.",
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Pick 5 to 8 strongest standalone reel moments from these transcript windows.",
          rules: [
            "Use only the provided windows.",
            "Keep startTime and endTime from the chosen window.",
            "Scores are integers 1-5.",
            "totalScore must equal hook + clarity + emotion + novelty + shareability.",
            "status must be suggested.",
          ],
          outputShape: {
            candidates: [
              {
                title: "short punchy title",
                startTime: "m:ss",
                endTime: "m:ss",
                transcript: "verbatim useful snippet",
                hook: 1,
                clarity: 1,
                emotion: 1,
                novelty: 1,
                shareability: 1,
                totalScore: 5,
                reason: "why this works as a reel",
                status: "suggested",
              },
            ],
          },
          windows: windows.map(({ id, startTime, endTime, transcript }) => ({
            id,
            startTime,
            endTime,
            transcript,
          })),
        }),
      },
    ],
    response_format: { type: "json_object" },
  });
  const content = response.choices[0]?.message.content;

  if (!content) {
    throw new Error("OpenAI returned no candidate JSON.");
  }

  const parsed = JSON.parse(content) as { candidates?: Candidate[] };
  const candidates = parsed.candidates?.map(normalizeCandidate) ?? [];

  if (!candidates.length) {
    throw new Error("OpenAI returned no candidates.");
  }

  return candidates.slice(0, 8);
}

function normalizeCandidate(candidate: Candidate): Candidate {
  const hook = clampScore(candidate.hook);
  const clarity = clampScore(candidate.clarity);
  const emotion = clampScore(candidate.emotion);
  const novelty = clampScore(candidate.novelty);
  const shareability = clampScore(candidate.shareability);

  return {
    title: String(candidate.title || "Candidate reel").slice(0, 120),
    startTime: String(candidate.startTime),
    endTime: String(candidate.endTime),
    transcript: String(candidate.transcript || "").slice(0, 1600),
    hook,
    clarity,
    emotion,
    novelty,
    shareability,
    totalScore: hook + clarity + emotion + novelty + shareability,
    reason: String(candidate.reason || "Strong standalone moment.").slice(0, 500),
    status: "suggested",
  };
}

function clampScore(value: number) {
  return Math.min(5, Math.max(1, Math.round(Number(value) || 1)));
}

function wordsFromPayload(payload: unknown): Word[] {
  if (!payload || typeof payload !== "object" || !("words" in payload)) {
    return [];
  }

  const words = (payload as { words?: unknown }).words;

  if (!Array.isArray(words)) {
    return [];
  }

  return words.flatMap((word): Word[] => {
    if (
      word &&
      typeof word === "object" &&
      "word" in word &&
      "start" in word &&
      "end" in word &&
      typeof word.word === "string" &&
      typeof word.start === "number" &&
      typeof word.end === "number"
    ) {
      return [{ word: word.word, start: word.start, end: word.end }];
    }

    return [];
  });
}

function score(text: string, terms: string[]) {
  const hits = terms.filter((term) => text.includes(term)).length;

  return Math.min(5, Math.max(1, hits + 2));
}

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function formatTime(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;

  return hours
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${minutes}:${pad(secs)}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
