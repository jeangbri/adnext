import { NextRequest, NextResponse } from "next/server";
import { processBroadcasts } from "@/lib/broadcast-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const key = req.nextUrl.searchParams.get("key");
    const authHeader = req.headers.get("authorization");

    // Allow if key matches RUNNER_SECRET OR if Auth header matches CRON_SECRET (Vercel standard)
    const isKeyValid = key === process.env.RUNNER_SECRET;
    const isCronValid = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (!isKeyValid && !isCronValid) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await processBroadcasts();
        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
