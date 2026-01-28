import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL environment variable is missing.');
    console.warn('   Skipping Prisma generation to prevent install failure.');
    console.warn('   This is expected during "pnpm install" on Vercel if env vars are restricted.');
    process.exit(0);
}

console.log('✅ DATABASE_URL found. Running prisma generate...');

// Use npx to ensure we use the local prisma binary
const child = spawn('npx', ['prisma', 'generate', '--schema=./prisma/schema.prisma'], {
    stdio: 'inherit',
    shell: true,
    cwd: path.resolve(__dirname, '..') // Run from packages/db root
});

child.on('close', (code) => {
    process.exit(code ?? 0);
});
