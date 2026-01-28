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
        const { workspaceId, userId } = stateData;

        const appId = process.env.IG_APP_ID!;
        const appSecret = process.env.IG_APP_SECRET!;
        const redirectUri = `${process.env.APP_URL}/api/messenger/callback`;

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

        // 3. Store Pages in DB
        // Assuming we repurpose 'InstagramAccount' table or create 'MessengerAccount'?
        // The prompt says "focado 100% no Messenger".
        // I will use `InstagramAccount` table for now but mapped to Messenger Pages, or I should really create a new table.
        // Given constraints and "Remodel", using existing schema is faster but risky if fields differ.
        // IG schema has `igUserId`, `username`, `profilePicUrl`.
        // FB Page has `id` (pageId), `name`, `picture` (edge).
        // I will Map: igUserId -> pageId, username -> pageName.
        // This keeps the Schema valid without migration for now (unless I can migrate).

        // However, FB Page automations need the PAGE ACCESS TOKEN.
        // `pagesData` returns `access_token` for each page. This is what we need.

        let count = 0;
        for (const page of pages) {
            // Check if page has messaging tasks
            // if (!page.tasks.includes('MESSAGING')) continue; // Optional check

            // Fetche Profile Pic
            const picRes = await fetch(`https://graph.facebook.com/v19.0/${page.id}/picture?redirect=false&access_token=${userAccessToken}`);
            const picData = await picRes.json();
            const profilePicUrl = picData.data?.url || '';

            await prisma.connectedAccount.upsert({
                where: {
                    workspaceId_providerAccountId: {
                        workspaceId,
                        providerAccountId: page.id
                    }
                },
                update: {
                    name: page.name,
                    profilePicUrl: profilePicUrl,
                    status: 'CONNECTED',
                    accessTokenEncrypted: encrypt(page.access_token), // Page Token
                    updatedAt: new Date(),
                },
                create: {
                    workspaceId,
                    providerAccountId: page.id,
                    name: page.name,
                    profilePicUrl: profilePicUrl,
                    status: 'CONNECTED',
                    accessTokenEncrypted: encrypt(page.access_token),
                    tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60) // Long lived usually
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
