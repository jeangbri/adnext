import { NextRequest, NextResponse } from "next/server";
import { getDueExecutions } from "@/lib/scheduler";
import { processExecution } from "@/lib/execution-processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/messenger/runner-sweep
 * Cron job that finds all due scheduled executions and processes them.
 * Called by Vercel Cron every 5 minutes.
 * Auth: Vercel Cron injects Bearer CRON_SECRET automatically.
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Allow Bearer token (Vercel Cron) or query param (manual)
    const key = req.nextUrl.searchParams.get("key");
    const runnerSecret = process.env.RUNNER_SECRET;

    const isAuthorized =
        (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
        (cronSecret && key === cronSecret) ||
        (runnerSecret && authHeader === `Bearer ${runnerSecret}`) ||
        (runnerSecret && key === runnerSecret);

    if (!isAuthorized) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // Fetch due executions from Postgres
    const dueIds = await getDueExecutions(20);

    if (dueIds.length === 0) {
        return NextResponse.json({ ok: true, count: 0, message: 'No due executions' });
    }

    console.log(`[Sweep] Found ${dueIds.length} due executions`);

    const results = [];

    // Process sequentially to be safe on resources
    for (const id of dueIds) {
        try {
            const res = await processExecution(id);
            results.push({ id, status: res?.status || 'UNKNOWN' });
        } catch (e: any) {
            console.error(`[Sweep] Failed individual run ${id}`, e);
            results.push({ id, status: 'ERROR' });
        }
    }

    return NextResponse.json({
        ok: true,
        count: results.length,
        results
    });
}

// Allow POST for pg_net calls (Supabase cron)
export async function POST(req: NextRequest) {
    return GET(req);
}
