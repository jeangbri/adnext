
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Connecting to database...');
    try {
        // List all tables using raw SQL query
        const tables: any[] = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

        console.log('Tables found in database:');
        for (const t of tables) {
            const tableName = t.table_name;
            // Count rows for each table
            // Note: Using dynamic SQL requires caution, but this is a diagnostic script run by the agent.
            // Prisma doesn't support easy dynamic table names in queryRaw, so we'll just list them.
            // We can try to map some known ones manually or use a helper but let's just list them first.
            try {
                const countResult: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tableName}"`);
                const count = countResult[0].count; // count is usually a BigInt
                console.log(`- ${tableName}: ${count.toString()} rows`);
            } catch (err) {
                console.log(`- ${tableName}: (Error counting: ${err.message})`);
            }

        }

    } catch (e) {
        console.error('Error querying database:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
