
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    try {
        console.log('Unscheduling old job...')
        await prisma.$executeRawUnsafe(`SELECT cron.unschedule('sweep-pending-executions');`).catch(() => { });

        console.log('Scheduling new job...')
        await prisma.$executeRawUnsafe(`
            SELECT cron.schedule(
                'sweep-pending-executions',
                '* * * * *',
                $$
                SELECT net.http_post(
                    url := 'https://adnext-web.vercel.app/api/messenger/runner-sweep',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || '46GYApzjM4VFHp3GpdPYb4aE7ZuuFdnP'
                    ),
                    body := '{}'::jsonb
                ) AS request_id;
                $$
            );
        `)
        console.log('Job scheduled successfully!')
    } catch (e: any) {
        console.error('Failed:', e.message)
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
