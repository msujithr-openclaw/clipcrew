# Hackathon Strategy

## Track choice

Choose **AI as Agency**.

Reason: ClipCrew maps naturally to an agent organization replacing a podcast social media agency. This gives a stronger rubric fit than positioning it as a generic viral clips generator.

## Winning demo narrative

> A podcaster normally gives a long episode to an editor/social media manager. They find moments, cut clips, write captions, get approval, and publish. ClipCrew replaces that agency workflow with Hermes agents.

## Rubric mapping

### Working product shipping real output — 20x

Ship at least one real output:

- captioned short clip MP4
- public preview page
- exported social post draft
- ideally a real post on a consenting creator account

### Agent org structure — 5x

Show named specialists:

- Producer / Manager
- Transcriber
- Moment Scorer
- Hook Judge
- Clip Cutter
- Caption Writer
- Publisher

### Observability — 7x

Maintain a visible run log with:

- run ID
- agent name
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

## 8-hour build order

1. Landing page + waitlist / CTA
2. Basic upload or YouTube input
3. Transcript ingestion
4. Candidate clip detection
5. Clip scorecard and run log
6. Basic MP4 cutting with captions
7. Approval preview page
8. Export/publish receipt
9. Demo polish

## What to avoid

Do not spend the day building a perfect video editor. The judges need to see the agency workflow working end-to-end.

## Proof bar

The bar is **published/exported output plus trace**, not just a rendered clip.
