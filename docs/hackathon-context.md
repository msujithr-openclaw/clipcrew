# ClipCrew Hackathon Context

This document persists the working context for the hackathon build so the team can restart from here without relying on chat history.

## Event context

We are participating in a Hermes Buildathon / hackathon with a 4-hour remaining build window for this project phase.

The product must qualify under the hackathon rule:

> Every team must use Hermes in at least one of two ways: either Hermes is the coding partner that built the product, or Hermes is the base harness that end users interact with.

For ClipCrew, the chosen eligibility path is:

> **Hermes is the coding partner.**

Hermes is not embedded in the product runtime. We will keep Hermes session receipts, GitHub commits, and build history as proof that Hermes helped build the product.

## Product being built

**Name:** ClipCrew

**One-liner:** An AI social media agency for podcasters. Upload a podcast episode and an agentic workflow finds, scores, cuts, captions, and prepares short-form clips.

## Chosen track

**Track:** AI as Agency

Reason: The product naturally maps to an agency workflow that replaces the work of a podcast social media/editorial team:

1. Producer / Manager plans the job.
2. Transcriber creates timestamped transcript.
3. Moment Scorer finds candidate clips.
4. Judge Panel scores and rejects weak clips.
5. Clip Cutter creates vertical short clips or previews.
6. Caption Writer writes hooks, titles, captions, and subtitles.
7. Creator Approval Gate allows approve/reject.
8. Publisher / Exporter produces final output or receipt.

## Important positioning

Do **not** position this as a generic podcast clip generator or OpusClip clone.

Position it as:

> An AI social media agency for podcasters, built with Hermes as the coding partner.

The judge-facing story is the workflow, trace, and output — not just video generation.

## Runtime decision

We decided **not** to run Hermes agents inside the application.

Product runtime should use one of:

- LangGraph / LangChain-style workflow orchestration
- custom typed workflow nodes
- lightweight backend service pipeline

The product should visibly behave like an agent crew, but these roles can be normal workflow nodes/services.

## Hackathon scoring priorities

For AI as Agency, optimize for:

### 1. Working product shipping real output — 20x

Must show at least one real output:

- captioned short clip MP4, or
- public preview page, or
- exported social post draft, or
- real post on a consenting creator account if feasible.

### 2. Agent org structure — 5x

Show clear named roles and handoffs:

- Producer / Manager
- Transcriber
- Moment Scorer
- Hook Judge
- Clip Cutter
- Caption Writer
- Publisher / Exporter

### 3. Observability — 7x

A visible run log/trace is critical. It should show:

- run ID
- role/node name
- status
- input summary
- output summary
- timestamps
- candidate clip scores
- rejection reasons
- export/publish receipt

### 4. Evaluation and iteration — 5x

Each candidate clip should have a scorecard:

| Criterion | Score |
|---|---:|
| Hook strength | 1-5 |
| Standalone clarity | 1-5 |
| Emotion | 1-5 |
| Novelty | 1-5 |
| Shareability | 1-5 |

### 5. Handoffs and memory — 2x

Persist creator/show profile where possible:

- show name
- audience
- tone
- banned topics
- preferred caption style
- prior winning formats

## Power-up priorities

Preferred power-ups if time allows:

1. **Convex** — state, run logs, clip scores, creator memory, receipts.
2. **Cloudflare** — landing page, preview page, approval page.
3. **Linkup** — live research on current clip formats/hooks.

Do not chase power-ups before the core demo works.

## 4-hour execution plan

Detailed roadmap is stored at:

`docs/plans/2026-07-12-4-hour-mvp-roadmap.md`

Short version:

```text
0:00-0:15   repo + scaffold
0:15-0:40   landing + input UI
0:40-1:20   workflow trace
1:20-2:00   candidate clip scoring
2:00-2:35   approval + export receipt
2:35-3:20   clip artifact / preview
3:20-3:40   Convex/Cloudflare if quick
3:40-4:00   demo polish + Hermes receipts
```

## P0 must ship

- Web UI
- Run trace / agency workflow
- Candidate clip scoring
- Approval/export receipt
- At least one generated artifact or strong preview

## P1 if time allows

- real FFmpeg clip export
- Convex run logs
- Cloudflare deployment
- LLM-generated scoring/captions

## P2 only if ahead

- YouTube ingestion
- real transcription API
- actual social posting
- Linkup trend research
- analytics feedback loop

## Fallback rules

If real transcription blocks progress:

- use pasted transcript or sample transcript.

If video processing blocks progress for more than 30 minutes:

- use a preview-card artifact with transcript, captions, timestamps, score, and export receipt.

If Convex setup blocks progress:

- use local/in-memory data first and add Convex only after the demo path works.

If deployment blocks progress:

- demo locally, push repo, and show the workflow clearly.

## Demo script

1. “ClipCrew is an AI social media agency for podcasters.”
2. “Hermes built the product; Hermes is our coding partner, not embedded runtime.”
3. Submit sample podcast input.
4. Show agency trace.
5. Show ranked candidate clips and judge panel scores.
6. Approve one clip.
7. Show generated/exported artifact or preview receipt.
8. Show GitHub commits + Hermes session receipts.

## Repo

GitHub: https://github.com/msujithr-openclaw/clipcrew

Local path:

`/home/ec2-user/.hermes/projects/clipcrew`

## Source rule document

The user shared the hackathon rules in this conversation. The uploaded source file is cached locally at:

`/home/ec2-user/.hermes/cache/documents/doc_d10fdc226e24_Hackathon.md`

If more detailed scoring language is needed, refer back to that file.
