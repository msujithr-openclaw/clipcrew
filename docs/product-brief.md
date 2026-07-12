# Product Brief

## Product name

ClipCrew

## One-liner

An AI social media agency for podcasters: upload an episode and an agentic workflow finds, scores, cuts, captions, and prepares viral short clips.

## Target user

Indie podcasters, founder-led podcasts, and small creator teams who publish long-form conversations but do not consistently produce short-form clips.

## Problem

Podcast creators know short clips drive discovery, but the workflow is slow:

- watch the full episode
- find strong moments
- trim clips
- write hooks and captions
- create subtitles
- get approval
- publish to social
- learn what worked

Most creators either skip this or outsource it inconsistently.

## Product insight

A good podcast clip is not just an interesting timestamp. It needs a narrative arc:

- setup
- tension or surprise
- payoff
- standalone clarity

The product should behave like a social media agency, not a dumb clipper.

## Important product boundary

Hermes is the build partner, not the product runtime.

ClipCrew should not depend on Hermes agents being embedded in the app. The product should implement its own workflow orchestration using LangGraph/LangChain-style nodes, custom workers, or another lightweight orchestrator.

This keeps the product easy to deploy, explain, and demo while still satisfying hackathon eligibility through Hermes coding-partner receipts.

## Core workflow

```text
Episode input
  -> Producer / Manager node
  -> Transcript node
  -> Moment scorer node
  -> Hook judge panel node
  -> Parallel clip cutter nodes
  -> Caption writer node
  -> Creator approval page
  -> Publisher / exporter node
  -> Run log + learning loop
```

## Candidate clip scoring

Each candidate moment should be scored on:

- hook strength
- standalone clarity
- emotional charge
- novelty / surprise
- audience relevance
- expected shareability
- clip length fit

## MVP success definition

By demo time, a judge should be able to see one podcast episode produce at least one real captioned short clip with a visible trace and approval/export flow.

The trace should make the workflow look like an agency crew: separate roles, handoffs, scoring, rejection reasons, and final receipts.

## Non-goals for v1

- embedding Hermes as the app runtime
- full video editor
- perfect automatic speaker cropping
- deep analytics retraining
- multi-platform publishing
- complex brand kit builder
- cinematic edits

The first version should optimize for agency workflow proof, not editing polish.
