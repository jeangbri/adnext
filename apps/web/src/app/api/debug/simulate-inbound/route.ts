
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processMessengerEvent } from "@/lib/messenger-service";

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { pageId, psid, text, type, payload, postId, commentId } = body;

    // Simulate standard Messenger Webhook structure
    let entry: any = {
        id: pageId,
        time: Date.now(),
    };

    if (type === 'comment') {
        // Feed Event
        entry.changes = [{
            field: "feed",
            value: {
                item: "comment",
                verb: "add",
                post_id: postId || `${pageId}_${Date.now()}`,
                comment_id: commentId || `comment_${Date.now()}`,
                from: { id: psid, name: "Test User" },
                message: text,
                created_time: Math.floor(Date.now() / 1000)
            }
        }];
    } else {
        // Messaging Event (text, postback)
        const messaging: any = {
            sender: { id: psid },
            recipient: { id: pageId },
            timestamp: Date.now()
        };

        if (type === 'postback') {
            messaging.postback = { payload: payload || text, title: text };
        } else {
            messaging.message = {
                mid: `mid_${Date.now()}`,
                text: text
            };
        }

        entry.messaging = [messaging];
    }

    const webhookBody = {
        object: "page",
        entry: [entry]
    };

    try {
        await processMessengerEvent(webhookBody);
        return NextResponse.json({ success: true, simulatedPayload: webhookBody });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
