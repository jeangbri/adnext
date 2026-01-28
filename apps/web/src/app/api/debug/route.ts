
import { NextResponse } from "next/server";
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    const debugInfo = {
        env: {
            PRISMA_CLIENT_ENGINE_TYPE: process.env.PRISMA_CLIENT_ENGINE_TYPE,
            NODE_ENV: process.env.NODE_ENV,
            VERCEL: process.env.VERCEL,
            PWD: process.env.PWD,
        },
        files: {
            cwd: process.cwd(),
            prismaFiles: [] as string[],
            nodeModulesPrisma: [] as string[],
        }
    };

    try {
        // Check .prisma/client location
        const searchPaths = [
            path.join(process.cwd(), 'node_modules/.prisma/client'),
            path.join(process.cwd(), '.next/server/chunks'), // Sometimes here
            '/var/task/node_modules/.prisma/client',
        ];

        for (const p of searchPaths) {
            if (fs.existsSync(p)) {
                try {
                    const files = fs.readdirSync(p);
                    // @ts-ignore
                    debugInfo.files.prismaFiles.push({ path: p, content: files });
                } catch (e: any) {
                    // @ts-ignore
                    debugInfo.files.prismaFiles.push({ path: p, error: e.message });
                }
            } else {
                // @ts-ignore
                debugInfo.files.prismaFiles.push({ path: p, exists: false });
            }
        }

    } catch (e: any) {
        // @ts-ignore
        debugInfo.error = e.message;
    }

    return NextResponse.json(debugInfo);
}
