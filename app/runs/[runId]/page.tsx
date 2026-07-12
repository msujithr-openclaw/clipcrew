export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white sm:px-8">
      <section className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl shadow-black/30">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-teal-200">
          ClipCrew Run
        </p>
        <h1 className="mt-4 text-3xl font-black sm:text-5xl">Run created</h1>
        <p className="mt-4 break-all rounded-2xl bg-black/30 p-4 font-mono text-sm text-zinc-200">
          {runId}
        </p>
        <p className="mt-6 text-lg text-zinc-300">Workflow trace coming next.</p>
      </section>
    </main>
  );
}
