
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    try {
        console.log('--- CRON JOB RUN DETAILS ---')
        const runs: any = await prisma.$queryRawUnsafe(`
            SELECT jobid, status, return_message, start_time, end_time 
            FROM cron.job_run_details 
            ORDER BY start_time DESC LIMIT 10
        `)
        console.log(JSON.stringify(runs, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value, 2))

        console.log('\n--- CRON JOBS ---')
        const jobs: any = await prisma.$queryRawUnsafe(`SELECT jobid, jobname, schedule, command, nodename FROM cron.job`)
        console.log(JSON.stringify(jobs, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value, 2))

        console.log('\n--- EXTENSIONS ---')
        const exts: any = await prisma.$queryRawUnsafe(`SELECT extname FROM pg_extension`)
        console.log(JSON.stringify(exts, null, 2))
    } catch (e: any) {
        console.error('Error querying cron:', e.message)
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
