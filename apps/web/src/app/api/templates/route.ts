
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TemplateService } from "@/lib/messenger-template-service";

// Since we put logic in service, API is thin wrapper.
// POST /api/templates/create
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { projectId, pageId, name, category, policy, contentJson, variablesJson } = body;

        // Validation
        if (!pageId || !name || !contentJson) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const template = await prisma.messengerTemplate.create({
            data: {
                projectId,
                pageId,
                name,
                category, // UTILITY | MARKETING | ...
                policy: policy || '24H',
                contentJson,
                variablesJson,
                status: 'ACTIVE'
            }
        });

        return NextResponse.json(template);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET /api/templates?pageId=...
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const pageId = searchParams.get('pageId');

    if (!pageId) {
        return NextResponse.json({ error: "Page ID required" }, { status: 400 });
    }

    const templates = await prisma.messengerTemplate.findMany({
        where: { pageId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(templates);
}
