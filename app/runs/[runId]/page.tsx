import { RunTraceClient } from "./RunTraceClient";

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  return (
    <main className="min-h-screen bg-[#f7f5f0] px-5 py-8 text-zinc-950 sm:px-8">
      <RunTraceClient runId={runId} />
    </main>
  );
}
