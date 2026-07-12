# ClipCrew

AI social media agency for podcasters.

ClipCrew turns a long podcast episode into ranked, ready-to-post short clips using an in-product agentic workflow: producer, transcriber, moment scorer, clip cutters, caption writer, creator reviewer, and publisher.

## Hackathon positioning

**Track:** AI as Agency  
**Core promise:** Drop a podcast episode; an agent-style workflow ships social-ready clips with visible handoffs, scores, approval, and publish receipts.

This is not just a podcast clipping tool. It is an AI agency workflow that replaces the work of a podcast social media team.

## Hermes usage

Hermes is used as the **coding partner** for the hackathon build, not as the product runtime.

That means:

- Hermes helps design, implement, debug, document, and deploy the product.
- We keep Hermes session receipts and commits as hackathon eligibility proof.
- End users do not interact with Hermes directly inside ClipCrew.
- The product runtime uses a dedicated orchestration layer such as LangGraph/LangChain-style workflows.

## Runtime approach

The app should expose an agent crew experience without embedding Hermes agents:

```text
Frontend
  -> Upload / YouTube input / approval UI
Backend API
  -> Starts a clip generation run
Workflow orchestrator
  -> Producer
  -> Transcriber
  -> Moment Scorer
  -> Judge Panel
  -> Clip Cutter(s)
  -> Caption Writer
  -> Publisher / Exporter
Convex
  -> Run logs, scores, creator memory, receipts
Cloudflare
  -> Landing page, preview pages, approval pages
```

## MVP flow

1. Creator uploads/pastes a podcast episode.
2. Producer node plans the job.
3. Transcriber creates timestamped transcript.
4. Moment scorer finds candidate clips.
5. Judge panel scores hooks and rejects weak moments.
6. Cutter nodes generate short vertical clips.
7. Caption node writes social copy and subtitles.
8. Creator approval page allows approve/reject.
9. Publisher/exporter outputs approved clips.
10. Run log shows every step and output.

## Judge demo goal

Show a real episode going through the workflow, then open:

- the run log / trace
- candidate clip scores
- approved clip preview
- final generated clip
- publish/export receipt
- Hermes session/commit receipts showing it was built with Hermes

## Planned power-ups

- **Convex:** run logs, clip scores, creator memory, publish receipts
- **Cloudflare:** landing page, approval/veto pages, public clip previews
- **Linkup:** live research on current clip formats and hooks

## Current status

Initial product docs only. Build implementation starts from here during the hackathon sprint.
