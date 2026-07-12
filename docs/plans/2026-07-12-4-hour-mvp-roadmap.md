# ClipCrew 4-Hour MVP Step-by-Step Implementation Plan

> **For Hermes:** Use Hermes as the coding partner. Do not embed Hermes agents in product runtime.

**Goal:** Build a judge-demoable ClipCrew MVP in 4 hours: a Cloudflare-deployable Next.js app backed by Convex, with a visible agency workflow, ranked candidate clips, approval/export receipts, and a Remotion-style preview artifact.

**Architecture:** Next.js + TypeScript + Tailwind on Cloudflare Pages, Convex as source of truth for state/logs, simple TypeScript workflow nodes for the agency flow, OpenAI API only inside scoring/caption nodes if available, Remotion components for preview polish. No LangGraph, OpenAI Agents SDK, or Hermes runtime in the app for MVP.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, Convex, OpenAI SDK/API optional, Remotion preview components, sample transcript fallback.

---

## Non-negotiable demo by T+4:00

A judge should see:

1. A public/product UI for ClipCrew.
2. A creator enters podcast title + transcript/sample input.
3. A visible agency workflow runs: Producer -> Transcriber -> Moment Scorer -> Judge Panel -> Caption Writer -> Approval Gate -> Exporter.
4. Candidate clips appear with timestamps, scores, and reasons.
5. User approves/rejects clips.
6. At least one approved clip has a caption, preview artifact, and export receipt.
7. Convex dashboard/run page proves workflow state and trace.
8. Hermes session/commit receipts prove Hermes was the coding partner.

## Brutal scope rule

The MVP is **not** a full OpusClip clone.

If video rendering blocks progress, use Remotion-style browser preview + export receipt. The scoring lever is the visible AI-agency workflow and trace, not perfect MP4 rendering.

---

## Phase 0 — Pre-build guardrails

### Task 0.1: Keep the product boundary clear

**Objective:** Ensure all implementation choices match the agreed architecture.

**Rules:**

- Hermes is coding partner only.
- Product runtime does not call Hermes.
- Product workflow uses TypeScript nodes and Convex logs.
- Do not add LangGraph or OpenAI Agents SDK in MVP.
- Do not block on real transcription or real MP4 rendering.

**Verification:**

- `docs/code-architecture.md` remains the source of truth.

---

## Phase 1 — 0:00-0:20 — Scaffold app and baseline dependencies

### Task 1.1: Create build branch

**Objective:** Start implementation safely from latest main.

**Commands:**

```bash
cd /home/ec2-user/.hermes/projects/clipcrew
git pull origin main
git checkout -b build/4-hour-mvp
```

**Verification:**

```bash
git branch --show-current
# expected: build/4-hour-mvp
```

### Task 1.2: Scaffold Next.js app in repo root

**Objective:** Create a deployable product shell.

**Command:**

```bash
bunx create-next-app@latest . --ts --tailwind --eslint --app --src-dir=false --import-alias "@/*"
```

If the command refuses because the directory is non-empty, create in a temp folder and copy app files back.

**Expected files:**

```text
app/page.tsx
app/layout.tsx
app/globals.css
package.json
next.config.ts
tsconfig.json
```

**Verification:**

```bash
bun install
bun run dev
```

Open local URL or use curl to verify it responds.

### Task 1.3: Install MVP dependencies

**Objective:** Add Convex and optional visual/AI packages.

**Command:**

```bash
bun add convex openai remotion
```

**Verification:**

```bash
bun run lint
```

Do not spend time fixing non-critical starter lint noise unless it blocks build.

### Task 1.4: Commit scaffold

**Command:**

```bash
git add .
git commit -m "feat: scaffold ClipCrew MVP app"
```

---

## Phase 2 — 0:20-0:55 — Convex source-of-truth setup

### Task 2.1: Initialize Convex

**Objective:** Create Convex backend folder and deployment URL.

**Command:**

```bash
bunx convex dev
```

Follow prompts to create/select a Convex project.

**Expected files:**

```text
convex/_generated/*
convex/README.md or starter files
.env.local with NEXT_PUBLIC_CONVEX_URL
```

**Cut line:** If Convex auth/setup takes more than 15 minutes, stop and use local mock state. But Convex is preferred because it directly supports the power-up and observability proof.

### Task 2.2: Add Convex client provider

**Objective:** Wrap the app in Convex provider.

**Create:** `app/ConvexClientProvider.tsx`

```tsx
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

**Modify:** `app/layout.tsx`

Wrap children with `ConvexClientProvider`.

**Verification:**

```bash
bun run lint
```

### Task 2.3: Define Convex schema

**Objective:** Create tables for run trace, candidates, receipts, and creator memory.

**Create/modify:** `convex/schema.ts`

Tables:

```text
runs
workflowSteps
candidateClips
exportReceipts
creatorProfiles
```

Fields should match `docs/code-architecture.md`.

**Verification:**

```bash
bunx convex dev
# expected: schema accepted / generated API updated
```

### Task 2.4: Add Convex query/mutation files

**Objective:** Create minimal typed backend functions.

**Create:**

```text
convex/runs.ts
convex/workflow.ts
convex/candidates.ts
convex/receipts.ts
```

**Minimum mutations/queries:**

```text
runs.createRun
runs.getRun
runs.updateRunStatus
workflow.listByRun
workflow.addStep
workflow.updateStep
candidates.listByRun
candidates.addMany
candidates.updateStatus
receipts.listByRun
receipts.createReceipt
```

**Verification:**

```bash
bunx convex dev
# expected: generated API includes new functions
```

### Task 2.5: Commit Convex setup

```bash
git add .
git commit -m "feat: add Convex run state and trace schema"
```

---

## Phase 3 — 0:55-1:25 — Landing page and run creation

### Task 3.1: Build landing UI

**Objective:** Make ClipCrew instantly understandable.

**Create/modify:**

```text
app/page.tsx
components/LandingHero.tsx
components/EpisodeInputForm.tsx
```

**Must include:**

- headline: “AI social media agency for podcasters”
- subheadline: “Upload/paste an episode and watch an agentic workflow find, score, caption, and prepare clips.”
- input fields:
  - show/podcast title
  - episode title
  - transcript textarea
  - optional URL field
- CTA: “Generate Clip Plan”

**Verification:**

- Page renders.
- Form accepts sample data.

### Task 3.2: Wire createRun mutation

**Objective:** Submitting the form creates a Convex run and navigates to run page.

**Modify:** `components/EpisodeInputForm.tsx`

Use `useMutation(api.runs.createRun)` and Next router navigation to `/runs/[runId]`.

**Verification:**

- Submit form.
- Convex dashboard shows new `runs` row.
- Browser navigates to `/runs/<id>`.

### Task 3.3: Commit landing/run creation

```bash
git add .
git commit -m "feat: add landing page and run creation"
```

---

## Phase 4 — 1:25-2:05 — Workflow orchestration and trace

### Task 4.1: Add shared workflow types and sample transcript

**Objective:** Centralize product models and fallback input.

**Create:**

```text
lib/workflow/types.ts
lib/workflow/sampleTranscript.ts
```

Types:

```ts
export type WorkflowRole =
  | "producer"
  | "transcriber"
  | "moment_scorer"
  | "judge_panel"
  | "caption_writer"
  | "approval_gate"
  | "exporter";

export type WorkflowStatus = "pending" | "running" | "completed" | "failed";
```

**Verification:**

```bash
bun run lint
```

### Task 4.2: Add Convex action `runClipCrew`

**Objective:** Run the full agency workflow and write step logs.

**Create:** `convex/actions.ts`

**Behavior:**

1. mark run `running`
2. add/complete producer step
3. add/complete transcriber step using pasted/sample transcript
4. add/complete moment scorer step
5. add candidates
6. add/complete judge panel step
7. add/complete caption writer step
8. add/complete approval gate step as waiting/ready
9. mark run `completed` or `awaiting_approval`

**Important:** Use deterministic candidate generation first. Add OpenAI only after deterministic flow works.

**Verification:**

- Trigger action manually from client or Convex dashboard.
- Workflow steps appear in Convex.

### Task 4.3: Trigger workflow after run creation

**Objective:** One form submit should create run and start the workflow.

**Preferred:** In `runs.createRun`, schedule action via Convex scheduler.

**Fallback:** In frontend, call action after mutation returns run ID.

**Verification:**

- Submit form.
- Run page updates with steps and candidates without manual DB edits.

### Task 4.4: Build workflow timeline component

**Create:** `components/WorkflowTimeline.tsx`

**Modify:** `app/runs/[runId]/page.tsx`

Use Convex queries to show:

- run title/status
- ordered workflow steps
- role labels
- status badges
- input/output summaries

**Verification:**

- Run page shows visible agency trace.

### Task 4.5: Commit workflow trace

```bash
git add .
git commit -m "feat: add agency workflow trace"
```

---

## Phase 5 — 2:05-2:40 — Candidate clips and scoring UI

### Task 5.1: Deterministic scorer

**Objective:** Always produce demoable candidate clips even without OpenAI.

**Create:**

```text
lib/workflow/momentScorer.ts
```

**Output:** 5-7 candidates with:

- title
- startTime/endTime
- transcript
- hook/clarity/emotion/novelty/shareability scores
- totalScore
- reason

**Verification:**

- Action writes ranked candidates to Convex.

### Task 5.2: Candidate clip cards

**Create:**

```text
components/CandidateClipCard.tsx
components/CandidateScoreCard.tsx
```

**Modify:** `app/runs/[runId]/page.tsx`

Show:

- rank
- title
- timestamp range
- transcript snippet
- total score
- score breakdown
- reason
- approve/reject controls placeholder

**Verification:**

- Run page shows candidate cards sorted by score.

### Task 5.3: Optional OpenAI scoring helper

**Objective:** Add real intelligence if credentials are available without risking demo.

**Create:**

```text
lib/ai/openai.ts
lib/ai/prompts.ts
lib/ai/parseJson.ts
```

**Rule:** If `OPENAI_API_KEY` is missing or call fails, fall back to deterministic scorer.

**Verification:**

- App works with no OpenAI key.
- If key exists, candidates can come from OpenAI JSON.

### Task 5.4: Commit candidate scoring UI

```bash
git add .
git commit -m "feat: add candidate clip scoring"
```

---

## Phase 6 — 2:40-3:10 — Approval, captions, and export receipt

### Task 6.1: Approval controls

**Objective:** Let creator approve/reject candidates.

**Create:** `components/ApprovalPanel.tsx`

**Use mutations:**

```text
candidates.updateStatus
receipts.createReceipt
```

**Behavior:**

- Approve sets candidate status to `approved`.
- Reject sets status to `rejected`.
- Approve creates export receipt with generated caption.

**Verification:**

- Clicking approve changes state in Convex.
- Receipt appears in Convex.

### Task 6.2: Caption writer

**Objective:** Generate a credible caption for approved clip.

**Create:** `lib/workflow/captionWriter.ts`

**Output shape:**

```ts
{
  hook: string;
  caption: string;
  hashtags: string[];
  subtitles: { start: string; end: string; text: string }[];
}
```

Use deterministic caption first; optional OpenAI later.

**Verification:**

- Approved clip has hook/caption/hashtags.

### Task 6.3: Export receipt card

**Create:** `components/ExportReceiptCard.tsx`

Show:

- status: `ready_to_publish`
- artifact/preview link
- caption
- created timestamp

**Verification:**

- Run page shows export receipt after approval.

### Task 6.4: Commit approval/export flow

```bash
git add .
git commit -m "feat: add approval and export receipts"
```

---

## Phase 7 — 3:10-3:35 — Remotion-style clip preview

### Task 7.1: Browser preview component

**Objective:** Make output feel like a real short-form video without blocking on MP4 rendering.

**Create:**

```text
components/ClipPreviewCard.tsx
lib/remotion/ClipComposition.tsx
lib/remotion/captions.ts
app/preview/[clipId]/page.tsx
```

**Preview should show:**

- 9:16 vertical frame
- hook/title overlay
- transcript as captions
- progress bar
- “Ready to publish” badge
- caption/hashtags below

**Verification:**

- Preview page opens for approved clip.
- Looks presentable in judge demo.

### Task 7.2: Optional Remotion package integration

**Objective:** Keep future MP4 path plausible.

If time allows, structure `ClipComposition` as a Remotion composition. Do not spend time making CLI render perfect.

**Verification:**

- UI preview still works.

### Task 7.3: Commit preview artifact

```bash
git add .
git commit -m "feat: add clip preview artifact"
```

---

## Phase 8 — 3:35-3:50 — Cloudflare Pages deployment

### Task 8.1: Prepare Cloudflare build

**Objective:** Make deployment plausible and, if possible, live.

**Files:**

```text
next.config.ts
wrangler.toml if needed
package.json scripts
```

**Build command options:**

For static/simple Next export if possible:

```bash
bun run build
```

For Cloudflare Next adapter if needed:

```bash
bun add -d @cloudflare/next-on-pages wrangler
bunx @cloudflare/next-on-pages
```

**Env var needed in Cloudflare:**

```text
NEXT_PUBLIC_CONVEX_URL=<production convex url>
```

**Cut line:** If Cloudflare deployment takes more than 15 minutes, keep local demo and push repo. Do not break working local app.

### Task 8.2: Commit deploy config if added

```bash
git add .
git commit -m "chore: add Cloudflare deployment config"
```

---

## Phase 9 — 3:50-4:00 — Final demo polish

### Task 9.1: Rehearse exact demo path

**Demo script:**

1. “ClipCrew is an AI social media agency for podcasters.”
2. “Hermes built the product; Hermes is our coding partner, not embedded runtime.”
3. Submit sample podcast input.
4. Show Convex-backed agency trace.
5. Show ranked candidate clips and judge panel scores.
6. Approve one clip.
7. Show preview artifact/export receipt.
8. Show GitHub commits + Hermes session receipts.

**Verification:**

- Demo takes under 2 minutes.
- No step depends on hidden terminal-only output.
- App works after fresh page reload.

### Task 9.2: Final push

```bash
git status --short
git push origin build/4-hour-mvp
```

If PR flow is desired:

```bash
gh pr create --fill
```

---

## Build priorities

### P0 — Must ship

- Next.js app starts locally
- Convex-backed run creation
- Visible workflow trace
- Ranked candidate clips
- Approve/reject
- Export receipt
- Preview artifact
- Repo pushed

### P1 — Strong scoring

- Cloudflare Pages live deployment
- Convex dashboard proof
- OpenAI-generated scores/captions
- Remotion-styled preview

### P2 — Only if ahead

- Real MP4 render
- Real transcription API
- YouTube ingestion
- Actual social posting
- Linkup trend research
- analytics feedback loop

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Convex setup delays build | Use local state fallback, but try Convex first for power-up |
| OpenAI API fails/missing key | Deterministic scorer/caption fallback |
| Video rendering takes too long | Browser preview artifact + receipt |
| Cloudflare deployment fails | Demo locally, push repo, show Convex dashboard |
| Judges question Hermes usage | Show session receipts and commits built through Hermes |
| Product seems like generic clipper | Emphasize agency roles, handoffs, trace, approval, receipts |

## Acceptance checklist

- [ ] App starts locally.
- [ ] Landing page explains ClipCrew clearly.
- [ ] User can create a Convex run.
- [ ] Run page shows workflow roles and statuses.
- [ ] Candidate clips are ranked with scores and reasons.
- [ ] User can approve/reject clips.
- [ ] Approved clip has caption and export/preview receipt.
- [ ] Preview artifact page exists and looks presentable.
- [ ] Convex dashboard shows run/steps/candidates/receipts.
- [ ] GitHub repo is pushed.
- [ ] Demo script is rehearsed.
