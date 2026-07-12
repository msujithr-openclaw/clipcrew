import { RunTraceClient } from "./RunTraceClient";

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white sm:px-8">
      <RunTraceClient runId={runId} />
    </main>
  );
}
