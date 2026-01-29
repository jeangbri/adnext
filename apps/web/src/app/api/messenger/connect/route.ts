import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryWorkspace } from "@/lib/workspace";
import { encrypt } from "@/lib/encryption";
import crypto from 'crypto';

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.redirect(new URL('/entrar', req.url));
    }

    const workspace = await getPrimaryWorkspace(user.id, user.email || '');

    // State for security
    const stateData = JSON.stringify({
        userId: user.id,
        workspaceId: workspace.id,
        nonce: crypto.randomBytes(16).toString('hex')
    });

    const state = encrypt(stateData);

    // Facebook Login Configuration
    const appId = process.env.FB_APP_ID!; // Using existing env var for simpler migration, or add MESSENGER_APP_ID later
    const redirectUri = `${process.env.APP_URL}/api/messenger/callback`; // Updated callback URI

    // Scopes for Messenger Automation
    const scopes = [
        'pages_show_list',
        'pages_messaging',
        'pages_manage_metadata',
        'pages_read_engagement',
        'public_profile'
    ].join(',');

    const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    authUrl.searchParams.append('client_id', appId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('response_type', 'code');

    return NextResponse.redirect(authUrl.toString());
}
