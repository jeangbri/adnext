import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
    // 1. Auth Check (User must be logged in)
    const authSupabase = createAuthClient();
    const { data: { user }, error: authError } = await authSupabase.auth.getUser();

    if (!user || authError) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse File
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (file.size > 20 * 1024 * 1024) { // 20MB limit
            return NextResponse.json({ error: "File too large (20MB max)" }, { status: 400 });
        }

        // 3. Upload using Service Role (Bypasses RLS)
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        const { data, error } = await supabaseAdmin.storage
            .from("media")
            .upload(filePath, buffer, {
                contentType: file.type,
                cacheControl: "3600",
                upsert: false
            });

        if (error) {
            console.error("Upload error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // 4. Get Public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from("media")
            .getPublicUrl(filePath);

        return NextResponse.json({ url: publicUrl });

    } catch (e: any) {
        console.error("Upload handler error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
