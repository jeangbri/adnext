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

        // 2. Get All User's Pages (Recursive Pagination)
        let allPages: FBPage[] = [];
        let nextUrl = `https://graph.facebook.com/v19.0/me/accounts?access_token=${userAccessToken}&limit=100`;

        while (true) {
            const pagesRes = await fetch(nextUrl);
            const pagesData = await pagesRes.json();

            if (!pagesRes.ok) throw new Error(pagesData.error?.message || "Failed to fetch pages");

            const currentPages = (pagesData.data || []) as FBPage[];
            allPages = [...allPages, ...currentPages];

            if (pagesData.paging?.next) {
                nextUrl = pagesData.paging.next;
            } else {
                break;
            }
        }

        const pages = allPages;
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

            // ---------------------------------------------------------
            // Subscribe App to Page Events (REQUIRED for Webhooks)
            // ---------------------------------------------------------
            try {
                const subscribeUrl = `https://graph.facebook.com/v19.0/${page.id}/subscribed_apps?access_token=${page.access_token}`;
                const subscribeRes = await fetch(subscribeUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        subscribed_fields: [
                            "messages",
                            "messaging_postbacks",
                            "messaging_optins",
                            "message_deliveries",
                            "message_reads",
                            "feed" // For comments automation
                        ]
                    })
                });

                if (!subscribeRes.ok) {
                    const subData = await subscribeRes.json();
                    console.error(`[Messenger Callback] Failed to subscribe page ${page.name}:`, subData);
                } else {
                    console.log(`[Messenger Callback] Subscribed app to page ${page.name}`);
                }
            } catch (subErr) {
                console.error(`[Messenger Callback] Subscription network error:`, subErr);
            }

            count++;
        }

        return NextResponse.redirect(new URL('/settings/integracoes?success=true&count=' + count, req.url));

    } catch (err) {
        console.error('[Messenger Callback] Error:', err);
        return NextResponse.redirect(new URL('/settings/integracoes?error=server_error', req.url));
    }
}

