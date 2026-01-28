
import { Client } from "@upstash/qstash";

const qstashClient = new Client({
    token: process.env.QSTASH_TOKEN!,
});

export const scheduleWorkflowResume = async (
    delayInSeconds: number,
    data: any
) => {
    // Determine the destination URL based on environment
    // In production (Vercel), use the actual domain.
    // In dev, if using ngrok, use that. If localhost strictly, QStash can't reach it without a tunnel.
    // We expect process.env.APP_URL to be set correctly.

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const destinationUrl = `${appUrl}/api/workflows/resume`;

    console.log(`[QStash] Scheduling resume to ${destinationUrl} in ${delayInSeconds}s`);

    await qstashClient.publishJSON({
        url: destinationUrl,
        body: data,
        delay: delayInSeconds,
    });
};
