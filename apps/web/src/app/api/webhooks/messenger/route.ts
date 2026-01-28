import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";

// Verification Helper
function verifySignature(body: string, signature: string, secret: string) {
    if (!signature) return false;
    const expected = "sha256=" + crypto.createHmac('sha256', secret).update(body).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function GET(req: NextRequest) {
    // Verification Request from Meta (Same for Instagram and Messenger)
    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    // We can reuse the same verify token env var
    const myToken = process.env.IG_VERIFY_TOKEN;

    if (mode === "subscribe" && token === myToken) {
        console.log("Messenger Webhook verified");
        return new NextResponse(challenge, { status: 200 });
    }

    return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
    const signature = req.headers.get("x-hub-signature-256");
    const bodyText = await req.text();

    const secret = process.env.IG_APP_SECRET!;

    let isValid = false;
    try {
        isValid = verifySignature(bodyText, signature || '', secret);
    } catch (e) {
        isValid = false;
    }

    let payload: any = {};
    try {
        payload = JSON.parse(bodyText);
    } catch (e) {
        return new NextResponse("Invalid JSON", { status: 400 });
    }

    // Idempotency: Hash of body.
    const platformEventId = crypto.createHash('sha256').update(bodyText).digest('hex');

    const existing = await prisma.webhookEvent.findUnique({
        where: { platformEventId }
    });

    if (existing) {
        return NextResponse.json({ ok: true });
    }

    // Create event
    const event = await prisma.webhookEvent.create({
        data: {
            platform: 'MESSENGER', // Explicitly Messenger
            eventType: payload.object || 'unknown', // 'page' usually
            platformEventId,
            payloadJson: payload,
            signatureValid: isValid,
            processingStatus: isValid ? 'PENDING' : 'ERROR',
            lastError: isValid ? null : 'Invalid Signature'
        }
    });

    if (!isValid) {
        return new NextResponse("Invalid Signature", { status: 401 });
    }

    // Inline processing helper
    try {
        const { handleWebhookJob } = await import("@/lib/messenger-service");
        await handleWebhookJob(event.id, payload);
    } catch (e) {
        console.error("Inline processing failed", e);
    }

    return NextResponse.json({ ok: true });
}
