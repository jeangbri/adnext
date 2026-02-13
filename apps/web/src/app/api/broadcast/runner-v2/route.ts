import { NextResponse } from "next/server";
import { broadcastRunnerV2 } from "@/lib/messenger/broadcast-v2/broadcast-runner-v2";

export async function GET() {
    try {
        // Basic security check - in production this should be authenticated
        // e.g., verifying a CRON_SECRET header

        await broadcastRunnerV2.run();

        return NextResponse.json({ success: true, message: "Runner executed" });
    } catch (error) {
        console.error("Broadcast Runner V2 Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
