
import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/dist/nextjs";
import { resumeWorkflowFromJob } from "@/lib/instagram-service";

export const dynamic = 'force-dynamic';

async function handler(req: NextRequest) {
    console.log("[API/Resume] Received resume request from QStash");

    try {
        const body = await req.json();
        await resumeWorkflowFromJob(body);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("[API/Resume] Error resuming workflow:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

// Security: Verify that the request comes from QStash
// Note: In development/localhost without a tunnel, signature verification might fail or complicate things. 
// Ideally, disable specific verification locally or mock it.
// For now, we use the library's built-in verification which disables automatically if not configured or in dev sometimes?
// Actually, verifySignatureAppRouter requires correct env vars.
// If running locally with `npm run dev` and Manually invoking, we might skip validation.
// For Vercel production, this IS REQUIRED.

export const POST = verifySignatureAppRouter(handler); 
