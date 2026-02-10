import { NextRequest, NextResponse } from "next/server";
import { processExecution } from "@/lib/execution-processor";
import { Receiver } from "@upstash/qstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    // 1. Auth & Input Parsing
    const bodyText = await req.text();
    let body: any;
    try {
        body = JSON.parse(bodyText);
    } catch {
        return new NextResponse("Invalid JSON", { status: 400 });
    }

    const { executionId } = body;
    if (!executionId) {
        return new NextResponse("Missing executionId", { status: 400 });
    }

    // 2. Security Check (QStash Signature OR Internal Secret)
    const signature = req.headers.get("upstash-signature");
    const authHeader = req.headers.get("authorization");

    let isAuthorized = false;

    // A) Verify QStash
    if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY) {
        const receiver = new Receiver({
            currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
            nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
        });

        try {
            // Verify body content
            const isValid = await receiver.verify({
                signature,
                body: bodyText,
                url: req.url // Strict URL check? locally might be tricky if proxied
            });
            if (isValid) isAuthorized = true;
        } catch (e) {
            console.warn("[Runner] QStash signature invalid", e);
        }
    }

    // B) Verify Internal Secret (Cron fallback or Manual)
    if (!isAuthorized && process.env.RUNNER_SECRET) {
        if (authHeader === `Bearer ${process.env.RUNNER_SECRET}`) {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
        console.warn("[Runner] Unauthorized attempt");
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // 3. Process Execution
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
