import { workflowRoleLabel } from "@/lib/workflow/runClipCrew";

export type TimelineStep = {
  role: string;
  status: string;
  order: number;
  inputSummary: string;
  outputSummary: string;
};

export function WorkflowTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="mt-8 space-y-4">
      {steps
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((step) => (
          <li
            className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5"
            key={`${step.order}-${step.role}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-200">
                  Step {step.order}
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">
                  {workflowRoleLabel(step.role)}
                </h2>
              </div>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
                {step.status}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/[0.05] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">
                  Input
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-200">
                  {step.inputSummary}
                </p>
              </div>
              <div className="rounded-2xl bg-white/[0.05] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">
                  Output
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-200">
                  {step.outputSummary}
                </p>
              </div>
            </div>
          </li>
        ))}
    </ol>
  );
}
