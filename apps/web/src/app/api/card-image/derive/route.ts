import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { deriveCardImage, getImageDimensions } from "@/lib/image/derive-card-image";
import { CardFormat } from "@/lib/types/card-format";

export const runtime = "nodejs";

/**
 * POST /api/card-image/derive
 * Body: { imageUrl: string, cardFormat: "SQUARE" | "PORTRAIT" | "LANDSCAPE" }
 * Returns: { derivedUrl: string, width: number, height: number }
 */
export async function POST(req: NextRequest) {
    // Auth
    const authSupabase = createAuthClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { imageUrl, cardFormat } = body as {
            imageUrl: string;
            cardFormat: CardFormat;
        };

        if (!imageUrl) {
            return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
        }

        if (!["SQUARE", "PORTRAIT", "LANDSCAPE"].includes(cardFormat)) {
            return NextResponse.json({ error: "Invalid cardFormat" }, { status: 400 });
        }

        // Fetch original image
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) {
            return NextResponse.json(
                { error: `Failed to fetch image: ${imgRes.status}` },
                { status: 400 }
            );
        }

        const arrayBuffer = await imgRes.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        // Derive (crop + resize)
        const result = await deriveCardImage(imageBuffer, cardFormat);

        // Upload derived image to Supabase Storage
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json(
                { error: "Server configuration error: Missing Supabase keys" },
                { status: 500 }
            );
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        const fileName = `derived_${cardFormat.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
        const filePath = `uploads/derived/${fileName}`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from("media")
            .upload(filePath, result.buffer, {
                contentType: "image/jpeg",
                cacheControl: "31536000",
                upsert: false,
            });

        if (uploadError) {
            console.error("Derived upload error:", uploadError);
            return NextResponse.json({ error: uploadError.message }, { status: 500 });
        }

        const { data: { publicUrl } } = supabaseAdmin.storage
            .from("media")
            .getPublicUrl(filePath);

        return NextResponse.json({
            derivedUrl: publicUrl,
            width: result.width,
            height: result.height,
        });
    } catch (e: any) {
        console.error("Card image derive error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/**
 * POST /api/card-image/derive?action=dimensions
 * Used by frontend to check image dimensions for mismatch warnings.
 * Handled via query param to keep same route.
 */
export async function PUT(req: NextRequest) {
    const authSupabase = createAuthClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { imageUrl } = body as { imageUrl: string };

        if (!imageUrl) {
            return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
        }

        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) {
            return NextResponse.json(
                { error: `Failed to fetch image: ${imgRes.status}` },
                { status: 400 }
            );
        }

        const arrayBuffer = await imgRes.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);
        const dimensions = await getImageDimensions(imageBuffer);

        return NextResponse.json(dimensions);
    } catch (e: any) {
        console.error("Image dimensions error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
