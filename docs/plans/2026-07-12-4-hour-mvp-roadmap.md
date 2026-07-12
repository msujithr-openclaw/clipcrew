# ClipCrew 4-Hour MVP Implementation Plan

> **For Hermes:** Use Hermes as the coding partner. Do not embed Hermes agents in product runtime.

**Goal:** Build a judge-demoable ClipCrew MVP in 4 hours: upload/provide podcast content, run an agentic workflow, score candidate clips, generate at least one captioned clip artifact, and show a visible trace.

**Architecture:** Use a pragmatic web app with an in-product workflow that looks like an AI agency. The workflow can be implemented as typed service nodes first, with LangGraph/LangChain-style orchestration added only if it does not slow the demo. Convex should store run logs and artifacts if setup is fast; otherwise use local JSON/mock persistence and clearly keep Convex as stretch.

**Tech Stack:** Next.js, TypeScript, Tailwind/shadcn-style UI, Convex if quick, FFmpeg/local media worker if feasible, LLM API for scoring/captions, static sample transcript fallback.

---

## Non-negotiable demo by T+4:00

A judge should see:

1. A public/product UI for ClipCrew.
2. A creator enters/uploads podcast input.
3. A visible agency workflow runs: Producer -> Transcriber -> Moment Scorer -> Judge Panel -> Clip Cutter -> Caption Writer -> Approval/Export.
4. Candidate clips appear with scores and reasons.
5. At least one approved clip has a generated/exported artifact or credible preview.
6. A run log/trace proves each step happened.
7. Hermes session/commit receipts prove Hermes was the coding partner.

## Brutal scope rule

If video rendering blocks progress for more than 30 minutes, switch to the fallback:

- use a sample podcast video/audio already available,
- cut/export one segment with FFmpeg locally,
- or show a clip preview artifact page with transcript, timestamps, captions, and export receipt.

Do not lose the hackathon trying to build OpusClip. The scoring lever is the agency workflow + trace.

---

## 4-Hour Roadmap

### 0:00-0:15 — Lock scope and repo setup

**Objective:** Start from latest main and create a build branch.

**Files:**
- Modify as needed after scaffolding.

**Steps:**

1. Pull latest main.
2. Create branch: `build/4-hour-mvp`.
3. Scaffold app only if repo has no app yet.
4. Commit scaffold.

**Verification:**

- `git status` clean after commit.
- Dev server starts locally.

**Cut line:** If package setup takes >15 min, use the fastest known starter and move on.

---

### 0:15-0:40 — Build landing + run creation UI

**Objective:** Create the visible product shell.

**Files:**
- `app/page.tsx` or equivalent
- `components/*` as needed

**Must include:**

- Product headline: “AI social media agency for podcasters.”
- Input options:
  - podcast title
  - YouTube/audio/video URL text field
  - paste transcript textarea fallback
- CTA: “Generate Clip Plan”

**Verification:**

- User can submit a sample transcript or URL.
- App navigates to a run page or renders run state.

---

### 0:40-1:20 — Implement workflow trace model

**Objective:** Make the app visibly behave like an agency crew.

**Files:**
- `lib/workflow/types.ts`
- `lib/workflow/runClipCrew.ts`
- `app/runs/[id]/page.tsx` or local equivalent

**Data model:**

```ts
type WorkflowStep = {
  id: string;
  role: 'producer' | 'transcriber' | 'moment_scorer' | 'judge_panel' | 'clip_cutter' | 'caption_writer' | 'approval_gate' | 'publisher';
  status: 'pending' | 'running' | 'completed' | 'failed';
  inputSummary: string;
  outputSummary?: string;
  startedAt?: string;
  completedAt?: string;
};
```

**Implementation:**

- Use deterministic mock/sample outputs first.
- Each role writes a step record.
- The run page displays a vertical trace/timeline.

**Verification:**

- One click creates a run with all roles visible.
- Completed steps show output summaries.

**Cut line:** Do not wire real Convex here if it slows trace visibility. In-memory/local JSON is acceptable for first pass.

---

### 1:20-2:00 — Candidate clip scoring

**Objective:** Produce 5-9 candidate moments with scorecards and reasons.

**Files:**
- `lib/workflow/scoring.ts`
- `components/CandidateClipCard.tsx`

**Candidate model:**

```ts
type CandidateClip = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  transcript: string;
  scores: {
    hook: number;
    clarity: number;
    emotion: number;
    novelty: number;
    shareability: number;
  };
  totalScore: number;
  reason: string;
  status: 'suggested' | 'approved' | 'rejected';
};
```

**Implementation:**

- Start with transcript heuristic scoring.
- If LLM API is ready, replace heuristic with LLM JSON output.
- Always keep deterministic fallback.

**Verification:**

- Run page shows ranked clip candidates.
- Each candidate has timestamps, score, and reason.

---

### 2:00-2:35 — Approval page and export receipt

**Objective:** Add the creator veto/approval loop.

**Files:**
- `components/ApprovalPanel.tsx`
- `app/runs/[id]/approve/page.tsx` or section on run page

**Implementation:**

- Approve/reject buttons update candidate status.
- Approved candidate creates an export/publish receipt.
- Receipt can be simple:

```ts
type ExportReceipt = {
  clipId: string;
  status: 'exported' | 'ready_to_publish';
  artifactUrl?: string;
  caption: string;
  createdAt: string;
};
```

**Verification:**

- Judge can approve one clip.
- UI shows “Ready to publish/exported” receipt.

---

### 2:35-3:20 — Clip artifact path

**Objective:** Produce the most credible clip artifact possible in remaining time.

**Preferred path:**

- Use FFmpeg to cut a short segment from a sample video.
- Generate/downloadable MP4.
- Show artifact on run page.

**Fallback path:**

- Generate a public preview card with:
  - vertical video placeholder
  - transcript snippet as captions
  - title/hook/caption
  - timestamps
  - export receipt

**Verification:**

- There is at least one output artifact visible from the UI.
- It ties back to a candidate clip and workflow trace.

**Cut line:** If FFmpeg is not working by 3:05, stop and use preview-card fallback.

---

### 3:20-3:40 — Convex/Cloudflare/power-up proof if quick

**Objective:** Add hackathon power-up evidence only if core MVP works.

**Convex minimum:**

- Store runs and workflow steps.
- Show Convex dashboard as evidence.

**Cloudflare minimum:**

- Deploy landing/preview page.
- Show live URL and dashboard.

**Verification:**

- Public URL opens.
- Run/preview page is accessible.

**Cut line:** If deployment blocks, keep local demo strong and document intended deploy path.

---

### 3:40-4:00 — Demo polish and receipts

**Objective:** Prepare the 2-minute judge demo.

**Demo script:**

1. “ClipCrew is an AI social media agency for podcasters.”
2. “Hermes built the product; Hermes is our coding partner, not embedded runtime.”
3. Submit sample podcast input.
4. Show agency trace.
5. Show ranked candidate clips and judge panel scores.
6. Approve one clip.
7. Show generated/exported artifact or preview receipt.
8. Show GitHub commits + Hermes session receipts.

**Verification:**

- Demo path takes under 2 minutes.
- No step depends on hidden terminal-only output.
- Repo is pushed.

---

## Build priorities

### P0 — Must ship

- Web UI
- Run trace
- Candidate scores
- Approval/export receipt
- At least one artifact/preview

### P1 — Strong scoring

- Real FFmpeg clip export
- Convex run log
- Cloudflare deployment
- LLM-generated scoring/captions

### P2 — Only if ahead

- YouTube ingestion
- Real transcription API
- Actual social posting
- Analytics feedback loop
- Linkup trend research

---

## Implementation strategy

1. Build the entire UX with sample data first.
2. Make the workflow trace convincing and structured.
3. Add real LLM scoring if credentials/time allow.
4. Add real media export only after the run flow is visible.
5. Deploy only after local demo is solid.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Video processing takes too long | Use preview-card fallback and one local FFmpeg sample |
| Transcription API fails | Use pasted transcript/sample transcript |
| Convex setup delays build | Use local state first, add Convex later |
| Deployment fails | Demo locally, push repo, show clear run flow |
| Judges question Hermes usage | Show session receipts and commits built through Hermes |

## Acceptance checklist

- [ ] App starts locally.
- [ ] Landing page explains ClipCrew clearly.
- [ ] User can create a run.
- [ ] Run page shows workflow roles and statuses.
- [ ] Candidate clips are ranked with scores and reasons.
- [ ] User can approve/reject clips.
- [ ] Approved clip has caption and export/preview receipt.
- [ ] At least one generated artifact or convincing preview exists.
- [ ] GitHub repo is pushed.
- [ ] Demo script is rehearsed.
