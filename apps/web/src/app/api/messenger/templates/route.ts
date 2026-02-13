import { NextRequest, NextResponse } from "next/server";
import { templateRegistry } from "@/lib/messenger/broadcast-v2/template-registry";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const pageId = searchParams.get('pageId');

    if (!pageId) {
        return NextResponse.json({ error: "pageId required" }, { status: 400 });
    }

    try {
        const templates = await templateRegistry.getApprovedTemplatesByPage(pageId);
        return NextResponse.json(templates);
    } catch (error) {
        console.error("Template fetch error", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
