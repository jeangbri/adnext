
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const campaignId = 'd764f4f7-f985-4a83-a4bd-bf55e77d96d0'
    const campaign = await prisma.broadcastCampaign.findUnique({
        where: { id: campaignId }
    })

    console.log('Campaign Details:', JSON.stringify(campaign, null, 2))

    if (campaign) {
        // Fetch logs to see who it was sent to
        const logs = await prisma.messageLog.findMany({
            where: { campaignId: campaignId }
        })
        console.log(`Initial message logs for this campaign: ${logs.length}`)

        // Also check BroadcastJobV2 if it exists
        try {
            const jobs = await (prisma as any).broadcastJobV2.findMany({
                where: { payload: { path: ['campaignId'], equals: campaignId } }
            })
            console.log(`BroadcastJobV2 found: ${jobs.length}`)
        } catch (e) { }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
