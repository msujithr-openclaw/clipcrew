# Hackathon Strategy

## Track choice

Choose **AI as Agency**.

Reason: ClipCrew maps naturally to an agent organization replacing a podcast social media agency. This gives a stronger rubric fit than positioning it as a generic viral clips generator.

## Eligibility strategy

Use Hermes as the **coding partner**.

This is one of the qualifying hackathon paths. The app itself does not need to run Hermes agents, as long as the team can show Hermes session receipts, prompts, commits, and build history.

Do not claim that end users interact with Hermes unless that is actually implemented.

## Winning demo narrative

> A podcaster normally gives a long episode to an editor/social media manager. They find moments, cut clips, write captions, get approval, and publish. ClipCrew replaces that agency workflow with an agentic product workflow built with Hermes as our coding partner.

## Runtime narrative

Implementation can use LangGraph/LangChain-style orchestration or custom workflow nodes.

The judge-facing point is not the framework name. The point is that the product visibly behaves like an agency:

- manager plans the job
- specialists execute different steps
- handoffs are visible
- weak clips get rejected
- creator approves final outputs
- output is exported or published
- logs prove the workflow happened

## Rubric mapping

### Working product shipping real output — 20x

Ship at least one real output:

- captioned short clip MP4
- public preview page
- exported social post draft
- ideally a real post on a consenting creator account

### Agent org structure — 5x

Show named workflow roles:

- Producer / Manager
- Transcriber
- Moment Scorer
- Hook Judge
- Clip Cutter
- Caption Writer
- Publisher

These do not need to be Hermes agents. They can be LangGraph nodes, workflow jobs, or typed service steps, as long as the product trace shows distinct responsibilities and handoffs.

### Observability — 7x

Maintain a visible run log with:

- run ID
- role/node name
- step status
- inputs / outputs
- timestamps
- candidate clip scores
- rejection reasons
- final export/publish receipt

### Evaluation and iteration — 5x

Use a simple scorecard for every candidate clip:

| Criterion | Score |
|---|---:|
| Hook strength | 1-5 |
| Standalone clarity | 1-5 |
| Emotion | 1-5 |
| Novelty | 1-5 |
| Shareability | 1-5 |

### Handoffs and memory — 2x

Store creator/show memory:

- show name
- audience
- tone
- banned topics
- preferred caption style
- prior winning formats

## Suggested stack

- **Hermes:** coding partner and build receipts
- **Next.js:** frontend and product shell
- **Convex:** state, run logs, clip scores, receipts, creator memory
- **Cloudflare Pages:** landing, preview, approval pages
- **LangGraph or custom orchestrator:** product workflow
- **FFmpeg:** clipping, cropping, subtitles
- **LLM API:** transcript analysis, scoring, captions
- **Transcription API/model:** Whisper, Deepgram, AssemblyAI, or equivalent

## 8-hour build order

1. Landing page + waitlist / CTA
2. Basic upload or YouTube input
3. Transcript ingestion
4. Candidate clip detection
5. Clip scorecard and run log
6. Basic MP4 cutting with captions
7. Approval preview page
8. Export/publish receipt
9. Demo polish + Hermes session receipts

## What to avoid

Do not spend the day building a perfect video editor. The judges need to see the agency workflow working end-to-end.

Also avoid making the product depend on Hermes runtime agents unless absolutely necessary. It adds deployment complexity and makes the story harder to explain.

## Proof bar

The bar is **published/exported output plus trace**, not just a rendered clip.

The eligibility proof is **Hermes coding-partner receipts**, not Hermes embedded in the product runtime.
