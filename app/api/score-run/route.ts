import { spawn } from "node:child_process";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const runId = typeof body?.runId === "string" ? body.runId : "";

  if (!/^k[a-z0-9]+$/.test(runId)) {
    return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
  }

  const child = spawn("bun", ["run", "score:run", runId], {
    cwd: process.cwd(),
    detached: true,
    env: process.env,
    stdio: "ignore",
  });

  child.unref();

  return NextResponse.json({ status: "started" }, { status: 202 });
}
