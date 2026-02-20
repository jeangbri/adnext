import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { META_DEFAULT_TEMPLATES, getUtilityTemplates } from "@/lib/messenger/broadcast-v2/meta-templates";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/messenger/templates?pageId=xxx
 *   - Returns approved templates for a page
 *   - Auto-seeds Meta default templates if the page has none
 *
 * GET /api/messenger/templates?pageId=xxx&all=true
 *   - Returns ALL templates (including non-approved) for management
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const pageId = searchParams.get('pageId');
    const showAll = searchParams.get('all') === 'true';

    if (!pageId) {
        return NextResponse.json({ error: "pageId required" }, { status: 400 });
    }

    try {
        // Check if this page has any templates
        const existingCount = await prisma.messengerTemplate.count({
            where: { pageId }
        });

        // Auto-seed Meta default templates if page has none
        if (existingCount === 0) {
            const utilityTemplates = getUtilityTemplates();
            await prisma.messengerTemplate.createMany({
                data: utilityTemplates.map(t => ({
                    pageId,
                    name: t.name,
                    category: t.category,
                    contentJson: t.contentJson,
                    policy: t.policy,
                    approved: true, // Meta templates are pre-approved
                    status: 'ACTIVE',
                    variablesJson: t.contentJson.variables || []
                }))
            });
        }

        // Fetch templates
        const where: any = { pageId };
        if (!showAll) {
            where.approved = true;
            where.status = 'ACTIVE';
        }

        const templates = await prisma.messengerTemplate.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        // Enrich with descriptions from meta-templates definitions
        const enriched = templates.map(t => {
            const metaDef = META_DEFAULT_TEMPLATES.find(m => m.name === t.name);
            return {
                ...t,
                description: metaDef?.description || '',
                tag: metaDef?.tag || null
            };
        });

        return NextResponse.json(enriched);
    } catch (error) {
        console.error("Template fetch error", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/**
 * POST /api/messenger/templates
 *   - Create a custom template for a page
 */
export async function POST(req: NextRequest) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { pageId, name, category, contentJson, policy } = body;

    if (!pageId || !name || !category || !contentJson) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
        const template = await prisma.messengerTemplate.create({
            data: {
                pageId,
                name,
                category: category || 'UTILITY',
                contentJson,
                policy: policy || 'UTILITY',
                approved: false, // Custom templates need approval
                status: 'ACTIVE',
                variablesJson: contentJson.variables || []
            }
        });

        return NextResponse.json(template);
    } catch (error) {
        console.error("Template create error", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
