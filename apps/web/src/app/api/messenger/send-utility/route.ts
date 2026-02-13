import { NextRequest, NextResponse } from "next/server";
import { utilitySender } from "@/lib/messenger/broadcast-v2/utility-sender";
import { ComplianceError } from "@/lib/messenger/broadcast-v2/types";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { recipient, template_id, message_category, context, page_id } = body;

        if (message_category !== 'UTILITY') {
            return NextResponse.json({ error: "Only UTILITY category supported on this endpoint" }, { status: 400 });
        }

        const result = await utilitySender.sendUtilityMessage({
            recipientPsid: recipient,
            templateId: template_id,
            pageId: page_id,
            context
        });

        return NextResponse.json(result);
    } catch (error: any) {
        if (error instanceof ComplianceError) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
        }
        console.error("Utility Send Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
