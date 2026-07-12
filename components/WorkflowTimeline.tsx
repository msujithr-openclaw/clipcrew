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
    <ol className="mt-4 space-y-3">
      {steps
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((step) => (
          <li
            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
            key={`${step.order}-${step.role}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-400">
                  Step {step.order}
                </p>
                <h2 className="mt-1 text-lg font-black text-zinc-950">
                  {workflowRoleLabel(step.role)}
                </h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                {step.status}
              </span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                  Input
                </p>
                <p className="mt-2 text-sm leading-5 text-zinc-600">
                  {step.inputSummary}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                  Output
                </p>
                <p className="mt-2 text-sm leading-5 text-zinc-600">
                  {step.outputSummary}
                </p>
              </div>
            </div>
          </li>
        ))}
    </ol>
  );
}
