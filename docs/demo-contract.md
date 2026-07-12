# ClipCrew Demo Contract

This document freezes the minimum demo contract before implementation starts. If time is tight, build exactly this and nothing more.

## Judge story

> ClipCrew is an AI social media agency for podcasters. Hermes built the product. The runtime is a Convex-backed TypeScript workflow where each specialist role logs its work, scores clips, gets creator approval, and produces a publish-ready preview.

## Product boundary

- Hermes is the coding partner and provides hackathon eligibility receipts.
- Hermes is not embedded in the product runtime.
- The product runtime uses Convex-backed TypeScript workflow nodes.
- OpenAI can be used inside scoring/caption nodes if available.
- Remotion is used for preview polish only; MP4 rendering is stretch.

## Required demo path

1. Open landing page.
2. Show headline: “AI social media agency for podcasters.”
3. Enter/paste podcast input or use built-in sample transcript.
4. Click “Generate Clip Plan.”
5. Navigate to run page.
6. Show workflow trace:
   - Producer
   - Transcriber
   - Moment Scorer
   - Judge Panel
   - Caption Writer
   - Approval Gate
   - Exporter
7. Show ranked candidate clips with scorecards and reasons.
8. Approve one candidate clip.
9. Show export receipt.
10. Open preview page for approved clip.
11. Show GitHub commits and Hermes receipts.

## Required screens

Only build these screens for MVP:

```text
/                 landing + input
/runs/[runId]     workflow trace + candidates + approval + receipt
/preview/[clipId] final vertical preview artifact
```

No auth, billing, dashboard, editor, workspace, or settings in MVP.

## Required data entities

### runs

Stores the overall episode processing run.

Minimum fields:

```text
title
episodeTitle
sourceType
sourceText
status
createdAt
completedAt
```

### workflowSteps

Stores the agency trace.

Minimum fields:

```text
runId
role
status
order
inputSummary
outputSummary
startedAt
completedAt
```

### candidateClips

Stores scored candidate clips.

Minimum fields:

```text
runId
title
startTime
endTime
transcript
hook
clarity
emotion
novelty
shareability
totalScore
reason
status
```

### exportReceipts

Stores approved output proof.

Minimum fields:

```text
runId
clipId
status
artifactUrl
hook
caption
hashtags
createdAt
```

## Sample input decision

Use built-in sample transcript as mandatory fallback.

The landing form should support:

- show/podcast title
- episode title
- optional source URL
- transcript textarea
- “Use sample transcript” path

If the user submits no transcript, the workflow uses the built-in sample transcript.

## Candidate scoring rubric

Each candidate clip is scored from 1 to 5 on:

| Criterion | Meaning |
|---|---|
| Hook | Does the clip open with a strong reason to keep watching? |
| Clarity | Can the clip stand alone without full episode context? |
| Emotion | Does it create feeling: surprise, tension, conviction, humor, or empathy? |
| Novelty | Is there a non-obvious idea, story, or opinion? |
| Shareability | Would someone repost, send, or comment on this? |

Total score:

```text
totalScore = hook + clarity + emotion + novelty + shareability
max = 25
```

No weighted scoring in MVP.

## Workflow roles

### Producer

Validates input and creates the job plan.

### Transcriber

Uses pasted/sample transcript. Real transcription is not required for MVP.

### Moment Scorer

Finds 5-7 candidate clips and assigns scores.

### Judge Panel

Ranks clips, rejects weak candidates, and explains why top clips are strong.

### Caption Writer

Writes hook, caption, hashtags, and subtitle-style lines for selected clips.

### Approval Gate

Lets creator approve or reject candidates.

### Exporter

Creates a publish-ready preview and export receipt.

## Fallback rules

| Problem | Fallback |
|---|---|
| Convex setup fails | Use local mock state, but preserve same data model |
| OpenAI unavailable | Use deterministic candidate scorer and caption writer |
| Remotion render fails | Use CSS vertical preview card |
| Cloudflare deployment fails | Demo locally and show pushed repo |
| Transcript unavailable | Use built-in sample transcript |
| MP4 rendering fails | Use preview artifact + export receipt |

## Cut lines

- Do not spend more than 15 minutes debugging Convex setup.
- Do not spend more than 10 minutes debugging OpenAI calls.
- Do not spend more than 15 minutes debugging Cloudflare deployment.
- Do not attempt real MP4 rendering until the run page, candidates, approval, and preview artifact work.

## Acceptance checklist

- [ ] Landing page loads.
- [ ] Sample transcript path works.
- [ ] Run page shows workflow trace.
- [ ] Candidate clips appear ranked by score.
- [ ] Candidate scorecards show all five criteria.
- [ ] Approve/reject changes candidate status.
- [ ] Approval creates export receipt.
- [ ] Preview page shows vertical clip artifact.
- [ ] Convex dashboard can show stored run data if Convex is enabled.
- [ ] GitHub commits prove Hermes-assisted build.

## Things explicitly out of scope

- real YouTube ingestion
- real podcast transcription as hard dependency
- full video editor
- real MP4 rendering as hard dependency
- actual social posting
- auth
- billing
- creator workspaces
- analytics feedback loop
- Linkup trend research unless everything else is done
