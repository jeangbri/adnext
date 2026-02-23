
import { processBroadcasts } from './src/lib/broadcast-runner';
import fs from 'fs';
import path from 'path';

// Manual env loading
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    env.split('\n').forEach(line => {
        const [key, ...values] = line.split('=');
        if (key && values.length > 0) {
            process.env[key.trim()] = values.join('=').trim().replace(/^"|"$/g, '');
        }
    });
}

async function m() {
    console.log('Starting broadcast runner...');
    console.log('Key:', process.env.APP_ENCRYPTION_KEY ? 'Present (len ' + process.env.APP_ENCRYPTION_KEY.length + ')' : 'Missing');
    const res = await processBroadcasts();
    console.log('Result:', JSON.stringify(res, null, 2));
}

m().catch(console.error);
