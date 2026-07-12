# Architecture

## Principle

ClipCrew is built by Hermes, but Hermes is not embedded in the product runtime.

The runtime should be a normal web product with a clear workflow orchestrator, persistent state, media processing, and public preview/approval surfaces.

## High-level system

```text
User / Creator
  -> Web App
  -> API route / backend worker
  -> Workflow orchestrator
  -> Media + LLM services
  -> Convex state and run logs
  -> Preview / approval page
  -> Export or publish receipt
```

## Components

### Web app

Responsibilities:

- landing page
- episode upload or URL input
- run status page
- candidate clips page
- creator approval/veto page
- final clip preview page

### Workflow orchestrator

Can be LangGraph, LangChain-style workflows, or a custom typed pipeline.

Suggested nodes:

1. `producer` — validates input and creates the run plan
2. `transcriber` — creates timestamped transcript
3. `moment_scorer` — finds candidate clips
4. `judge_panel` — scores/rejects candidates
5. `clip_cutter` — cuts selected segments with FFmpeg
6. `caption_writer` — writes title, hook, caption, subtitles
7. `approval_gate` — waits for creator approval
8. `publisher` — exports or publishes approved clips

### Convex

Responsibilities:

- runs
- workflow steps
- candidate clips
- scores
- creator/show memory
- output file metadata
- publish/export receipts

### Media processing

Use FFmpeg for the first version:

- extract segment by timestamp
- convert to vertical format
- burn or attach captions
- export MP4

Avoid advanced editing until the core workflow works.

### LLM layer

Responsibilities:

- transcript analysis
- candidate moment extraction
- hook/caption generation
- score reasoning
- rejection reasons

The LLM layer should be called from workflow nodes, not from a generic chat interface.

## Observability model

Every workflow node should write a structured step record:

```json
{
  "runId": "run_xxx",
  "node": "moment_scorer",
  "status": "completed",
  "startedAt": "...",
  "completedAt": "...",
  "inputSummary": "Timestamped transcript with 42 segments",
  "outputSummary": "Found 9 candidate clips",
  "artifactIds": ["clip_candidate_1", "clip_candidate_2"]
}
```

## Demo-critical artifacts

By judging time, the app should produce:

- one run page
- visible node-by-node trace
- scored candidate clips
- one approved clip
- one generated MP4
- one export or publish receipt
- Hermes session/commit receipts for eligibility

## Deployment notes

For the hackathon, it is acceptable to keep media processing pragmatic:

- web app deployed publicly
- Convex live backend
- local or server worker for FFmpeg if serverless deployment is too slow
- generated clips uploaded or linked from a public preview page

The demo should be honest about what is live and what is local, but the workflow must actually run.
