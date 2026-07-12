# ClipCrew Code Architecture

This document locks the code architecture for the 4-hour hackathon MVP.

## Final stack decision

```text
Frontend: Next.js + TypeScript + Tailwind
Deploy: Cloudflare Pages
Backend/state: Convex
Workflow: Simple TypeScript workflow nodes
AI: OpenAI API for scoring/captions
Video preview: Remotion components
Actual video render: stretch only
Hermes: coding partner only, not product runtime
```

## Architecture overview

```text
User
  -> Next.js App on Cloudflare Pages
     - landing page
     - transcript/input form
     - run dashboard
     - approval page
     - clip preview

  -> Convex
     - runs
     - workflow steps
     - candidate clips
     - scores
     - approval status
     - export receipts

  -> Workflow Orchestrator
     - producer()
     - transcriberFallback()
     - momentScorer()
     - judgePanel()
     - captionWriter()
     - exporter()

  -> Optional Remotion renderer
     - browser preview first
     - local/server MP4 render later if time
```

## Important decision: no LangGraph for MVP

Do not use LangGraph in the first 4-hour build.

The MVP workflow is fixed and predictable:

```text
input -> transcript -> score clips -> judge -> caption -> approve -> export
```

A simple typed TypeScript pipeline is faster, easier to debug, easier to deploy, and easier to show in Convex logs.

We can still present it as an agentic workflow because the product visibly has separate roles, handoffs, scoring, approval, and receipts.

## Repository structure

```text
clipcrew/
  app/
    page.tsx
    layout.tsx
    globals.css
    ConvexClientProvider.tsx
    runs/
      [runId]/
        page.tsx
    preview/
      [clipId]/
        page.tsx

  components/
    LandingHero.tsx
    EpisodeInputForm.tsx
    WorkflowTimeline.tsx
    CandidateClipCard.tsx
    CandidateScoreCard.tsx
    ApprovalPanel.tsx
    ClipPreviewCard.tsx
    ExportReceiptCard.tsx

  lib/
    workflow/
      types.ts
      runClipCrew.ts
      producer.ts
      transcriber.ts
      momentScorer.ts
      judgePanel.ts
      captionWriter.ts
      exporter.ts
      sampleTranscript.ts

    ai/
      openai.ts
      prompts.ts
      parseJson.ts

    remotion/
      ClipComposition.tsx
      captions.ts

  convex/
    schema.ts
    runs.ts
    workflow.ts
    candidates.ts
    receipts.ts
    actions.ts
```

## Convex responsibilities

Convex is the source of truth for the demo.

### Tables

```text
runs
workflowSteps
candidateClips
exportReceipts
creatorProfiles
```

### Mutations

```text
createRun
updateRunStatus
addWorkflowStep
updateWorkflowStep
addCandidateClips
approveClip
rejectClip
createExportReceipt
```

### Queries

```text
getRun
getWorkflowSteps
getCandidateClips
getReceipts
```

### Actions

```text
runClipCrew
scoreTranscriptWithOpenAI
generateCaptionsWithOpenAI
```

## Workflow design

Core entrypoint:

```ts
runClipCrew(runId)
```

Execution order:

```ts
producer();
transcriber();
momentScorer();
judgePanel();
captionWriter();
exporter();
```

Each step must write a visible record to Convex:

```ts
{
  role: "moment_scorer",
  status: "completed",
  inputSummary: "Timestamped transcript with 42 segments",
  outputSummary: "Found 7 candidate clips",
}
```

This is the core AI as Agency observability proof.

## OpenAI usage

Use OpenAI only inside specific workflow nodes.

### Moment scorer output shape

```json
[
  {
    "title": "Why most podcast clips fail",
    "startTime": "00:02:14",
    "endTime": "00:03:01",
    "transcript": "...",
    "scores": {
      "hook": 4,
      "clarity": 5,
      "emotion": 3,
      "novelty": 4,
      "shareability": 5
    },
    "reason": "Strong standalone opinion with clear payoff."
  }
]
```

### Caption writer output shape

```json
{
  "hook": "Most podcast clips fail for one simple reason.",
  "caption": "A good clip is not a timestamp. It is a story with setup, tension, and payoff.",
  "hashtags": ["podcasting", "creatoreconomy", "shorts"],
  "subtitles": [
    { "start": "00:00", "end": "00:03", "text": "Most podcast clips fail..." }
  ]
}
```

## Remotion role

Use Remotion for video preview polish, not core infrastructure.

### MVP Remotion

Render a browser-visible vertical preview:

```text
9:16 frame
hook/title overlay
caption text
sample/provided background
progress bar
```

### Stretch Remotion

Generate actual MP4 locally or from a separate worker:

```bash
npx remotion render
```

Do not block the core demo on MP4 rendering.

## MVP data flow

```text
1. User enters podcast title + transcript/sample input.
2. createRun mutation creates a run.
3. Convex action starts workflow.
4. Workflow writes step logs.
5. OpenAI/scoring generates candidate clips.
6. UI subscribes to Convex and updates live.
7. User approves one clip.
8. Caption/export receipt is generated.
9. Preview page shows final clip artifact.
```

## Explicit non-goals for v1

Do not build these in the 4-hour MVP:

- full LangGraph setup
- OpenAI Agents SDK orchestration
- real YouTube ingestion
- real transcription API as a dependency
- full FFmpeg/Remotion render queue
- real social posting
- authentication
- billing
- complex creator workspace

## Judge-facing explanation

Use this explanation:

> ClipCrew is an AI social media agency for podcasters. Hermes was our coding partner. The product runtime uses a simple typed workflow with visible agency roles: producer, transcriber, scorer, judge, caption writer, and exporter. Convex stores every handoff and score so judges can inspect the trace live.
