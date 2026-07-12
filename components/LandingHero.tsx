const workflowRoles = [
  "Producer",
  "Transcriber",
  "Moment Scorer",
  "Judge Panel",
  "Caption Writer",
  "Approval Gate",
  "Exporter",
];

export function LandingHero() {
  return (
    <section className="space-y-8 py-8 lg:py-0">
      <div className="inline-flex rounded-full border border-teal-300/30 bg-teal-300/10 px-4 py-2 text-sm font-medium text-teal-100 shadow-lg shadow-teal-950/30">
        Convex-backed agency workflow for short-form clips
      </div>

      <div className="space-y-5">
        <h1 className="max-w-3xl text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
          AI social media agency for podcasters.
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-zinc-300 sm:text-xl">
          Upload a video metadata stub or pick from the sample video library, then
          watch a specialist crew find, score, caption, approve, and package clips.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {workflowRoles.map((role, index) => (
          <div
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm text-zinc-200 backdrop-blur"
            key={role}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-zinc-950">
              {index + 1}
            </span>
            {role}
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-purple-300/20 bg-purple-300/10 p-5 text-sm leading-6 text-purple-100">
        Demo promise: video-library workflow first. R2 storage, real uploads, and
        MP4 rendering stay out of the MVP path.
      </div>
    </section>
  );
}
