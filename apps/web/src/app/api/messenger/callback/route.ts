import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FBPage {
    id: string;
    name: string;
    access_token: string;
    tasks: string[];
}

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error || !code || !state) {
        return NextResponse.redirect(new URL('/settings/integracoes?error=access_denied', req.url));
    }

    try {
        const stateData = JSON.parse(decrypt(state));
        const { workspaceId } = stateData;

        const appId = process.env.FB_APP_ID!;
        const appSecret = process.env.FB_APP_SECRET!;
        const baseUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        const redirectUri = `${baseUrl}/api/messenger/callback`;

        // 1. Exchange Code for User Access Token
        const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
        tokenUrl.searchParams.append('client_id', appId);
        tokenUrl.searchParams.append('client_secret', appSecret);
        tokenUrl.searchParams.append('redirect_uri', redirectUri);
        tokenUrl.searchParams.append('code', code);

        const tokenRes = await fetch(tokenUrl.toString());
        const tokenData = await tokenRes.json();

        if (!tokenRes.ok) throw new Error(tokenData.error?.message || "Failed to exchange token");

        const userAccessToken = tokenData.access_token;

        // 2. Get User's Pages
        const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${userAccessToken}&limit=100`);
        const pagesData = await pagesRes.json();

        if (!pagesRes.ok) throw new Error(pagesData.error?.message || "Failed to fetch pages");

        const pages = (pagesData.data || []) as FBPage[];
        let count = 0;

        for (const page of pages) {
            // Check permissions/tasks if strictly needed (e.g. MESSAGING)
            // if (!page.tasks.includes('MESSAGING')) continue; 

            const encryptedToken = encrypt(page.access_token);

            await prisma.messengerPage.upsert({
                where: {
                    pageId: page.id
                },
                update: {
                    workspaceId, // allow moving workspace? or keep original?
                    // keeping update means if I connect to new workspace, it moves ownership
                    pageName: page.name,
                    pageAccessToken: encryptedToken,
                    isActive: true,
                    updatedAt: new Date(),
                },
                create: {
                    workspaceId,
                    pageId: page.id,
                    pageName: page.name,
                    pageAccessToken: encryptedToken,
                    isActive: true
                }
            });
            count++;
        }

        return NextResponse.redirect(new URL('/settings/integracoes?success=true&count=' + count, req.url));

    } catch (err) {
        console.error('[Messenger Callback] Error:', err);
        return NextResponse.redirect(new URL('/settings/integracoes?error=server_error', req.url));
    }
}

