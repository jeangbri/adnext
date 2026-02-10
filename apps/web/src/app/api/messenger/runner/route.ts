import { NextRequest, NextResponse } from "next/server";
import { processExecution } from "@/lib/execution-processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/messenger/runner
 * Process a single scheduled execution by ID.
 * Called by the sweep cron or can be triggered manually.
 * Auth: CRON_SECRET or RUNNER_SECRET via Bearer token.
 */
export async function POST(req: NextRequest) {
    // 1. Auth
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const runnerSecret = process.env.RUNNER_SECRET;

    const isAuthorized =
        (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
        (runnerSecret && authHeader === `Bearer ${runnerSecret}`);

    if (!isAuthorized) {
        console.warn("[Runner] Unauthorized attempt");
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // 2. Parse Body
    let body: any;
    try {
        body = await req.json();
    } catch {
        return new NextResponse("Invalid JSON", { status: 400 });
    }

    const { executionId } = body;
    if (!executionId) {
        return new NextResponse("Missing executionId", { status: 400 });
    }

    // 3. Process
    try {
        const result = await processExecution(executionId);
        if (result && result.status === 'ERROR') {
            return new NextResponse(JSON.stringify(result), { status: 500 });
        }
        return NextResponse.json(result);
    } catch (e: any) {
        console.error(`[Runner] Execution failed`, e);
        return new NextResponse("Execution Error", { status: 500 });
    }
}
