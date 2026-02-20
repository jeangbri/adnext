import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";
import { getScopedContext } from "@/lib/user-scope";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [workspace, scope] = await Promise.all([
        getPrimaryWorkspace(user.id, user.email || ''),
        getScopedContext(user.id)
    ]);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const phoneOnly = searchParams.get("phoneOnly") !== "false";

    const skip = (page - 1) * limit;

    const where: any = {
        workspaceId: workspace.id,
    };

    // Only show contacts with phone numbers by default
    if (phoneOnly) {
        where.phone = { not: null };
    }

    // Page filter from scope
    const pageIds = scope?.pageIds;
    if (pageIds && pageIds.length > 0) {
        where.pageId = { in: pageIds };
    }

    // Search filter
    if (search) {
        where.OR = [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
        ];
    }

    try {
        const [leads, total] = await Promise.all([
            prisma.contact.findMany({
                where,
                orderBy: { lastSeenAt: "desc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    profilePicUrl: true,
                    firstSeenAt: true,
                    lastSeenAt: true,
                    tags: true,
                    pageId: true,
                },
            }),
            prisma.contact.count({ where }),
        ]);

        return NextResponse.json({
            leads,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (e: any) {
        console.error("[API/leads] Error:", e);
        return NextResponse.json(
            { error: e.message || "Internal error" },
            { status: 500 }
        );
    }
}
