import { NextRequest, NextResponse } from "next/server";
import { getDueExecutions } from "@/lib/scheduler";
import { processExecution } from "@/lib/execution-processor";

export const runtime = "nodejs"; // ou edge, mas usamos prisma/redis node
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Max duration for Pro (10s for Hobby)

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Allow manual sweep via ?key=SECRET (fallback) or Bearer Token (Vercel Cron)
    const key = req.nextUrl.searchParams.get("key");
    const isAuthorized = (cronSecret && authHeader === `Bearer ${cronSecret}`) || (cronSecret && key === cronSecret);

    if (!isAuthorized) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // Fetch due executions from ZSET (fallback queue)
    // QStash should handle most, but this catches failures or if QStash is not set up
    const dueIds = await getDueExecutions(20);

    const results = [];

    // Process sequentially to be safe on resources
    for (const id of dueIds) {
        try {
            const res = await processExecution(id);
            results.push({ id, status: res?.status || 'UNKNOWN' });
        } catch (e) {
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
