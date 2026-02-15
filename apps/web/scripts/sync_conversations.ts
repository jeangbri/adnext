
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const FB_API_VERSION = 'v19.0';
const prisma = new PrismaClient();

// --- ENCRYPTION LOGIC ---
const ALGORITHM = 'aes-256-cbc';
const ENCODING = 'hex';
// Default key if env is missing or invalid
const FALLBACK_KEY = '12345678901234567890123456789012';

// Load .env manualy
const envPath = path.resolve(process.cwd(), '.env');
let envKey = '';

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
        const [key, ...values] = line.split('=');
        if (key && key.trim() === 'APP_ENCRYPTION_KEY') {
            let val = values.join('=').trim();
            if ((val.startsWith('"') && val.endsWith('"'))) {
                val = val.slice(1, -1);
            }
            envKey = val;
        }
    });
}

function tryDecrypt(text: string): string | null {
    if (!text) return null;
    if (!text.includes(':')) {
        // Assume not encrypted or different format
        console.warn('DEBUG: Token appears unencrypted (no colon).');
        return text;
    }

    const textParts = text.split(':');
    const ivHex = textParts.shift() as string;
    const encryptedHex = textParts.join(':');

    // Candidates
    const candidates = [];
    if (envKey && envKey.length === 32) candidates.push(envKey);
    if (envKey && envKey.length > 32) candidates.push(envKey.substring(0, 32));
    candidates.push(FALLBACK_KEY);

    for (const keyCandidate of candidates) {
        try {
            const iv = Buffer.from(ivHex, ENCODING);
            const encryptedText = Buffer.from(encryptedHex, ENCODING);
            const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(keyCandidate), iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            const result = decrypted.toString();

            // Basic validation: Token usually starts with EAA
            if (result.startsWith('EAA') || result.length > 20) {
                console.log(`DEBUG: Decryption successful with key: ${keyCandidate.substring(0, 3)}...`);
                return result;
            }
        } catch (e) {
            // Ignore and try next
        }
    }

    console.error('DEBUG: Failed to decrypt with any candidate key.');
    return null;
}

async function fetchFb(endpoint: string, params: Record<string, string> = {}, accessToken: string) {
    if (!accessToken) throw new Error("Access Token is empty");

    const url = new URL(`https://graph.facebook.com/${FB_API_VERSION}/${endpoint}`);
    url.searchParams.append('access_token', accessToken);
    for (const [k, v] of Object.entries(params)) {
        url.searchParams.append(k, v);
    }

    const res = await fetch(url.toString());
    const text = await res.text();

    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error(`FB API returned non-JSON response: ${text.substring(0, 100)}... (Status: ${res.status})`);
    }

    if (data.error) {
        throw new Error(`FB Error [${endpoint}]: ${data.error.message}`);
    }
    return data;
}

async function main() {
    console.log('Starting Conversation Sync...');

    // 1. Get Page from DB
    const page = await prisma.messengerPage.findFirst();

    if (!page) {
        console.error('❌ No Page found in database.');
        return;
    }

    console.log(`✅ Found Page: ${page.pageName} (ID: ${page.pageId})`);

    const decryptedToken = tryDecrypt(page.pageAccessToken);

    if (!decryptedToken) {
        console.error('❌ Critical: Could not decrypt page access token. Cannot proceed.');
        return;
    }

    try {
        // 2. Fetch Conversations
        console.log('Fetching conversation history from Facebook...');
        // participants{id,name},updated_time,messages.limit(1){message}
        // Limit to 100 for now
        const data = await fetchFb('me/conversations', {
            fields: 'participants,updated_time,snippet',
            limit: '100'
        }, decryptedToken);

        const conversations = data.data || [];
        console.log(`Found ${conversations.length} conversations.`);

        let newContacts = 0;
        let updatedContacts = 0;

        for (const conv of conversations) {
            // Filter out the page itself from participants
            const participant = conv.participants.data.find((p: any) => p.id !== page.pageId);
            if (!participant) continue;

            const psid = participant.id;
            const name = participant.name;
            const lastSeen = new Date(conv.updated_time);
            const snippet = conv.snippet;

            // 3. Upsert Contact
            const existing = await prisma.contact.findUnique({
                where: { pageId_psid: { pageId: page.pageId, psid } }
            });

            if (existing) {
                await prisma.contact.update({
                    where: { id: existing.id },
                    data: {
                        lastSeenAt: lastSeen,
                        lastMessageText: snippet,
                        firstName: name.split(' ')[0],
                        lastName: name.split(' ').slice(1).join(' ')
                    }
                });
                updatedContacts++;
            } else {
                await prisma.contact.create({
                    data: {
                        workspaceId: page.workspaceId,
                        pageId: page.pageId,
                        psid: psid,
                        firstName: name.split(' ')[0],
                        lastName: name.split(' ').slice(1).join(' '),
                        profilePicUrl: `https://graph.facebook.com/${psid}/picture?type=large&access_token=${decryptedToken}`,
                        firstSeenAt: lastSeen,
                        lastSeenAt: lastSeen,
                        lastMessageText: snippet
                    }
                });
                newContacts++;
            }
            process.stdout.write(`\rProcessing: ${newContacts} new, ${updatedContacts} updated, ${newContacts + updatedContacts} total...`);
        }

        console.log('\n\n✅ Sync Complete!');
        console.log(`Summary: ${newContacts} created, ${updatedContacts} updated.`);

    } catch (e: any) {
        console.error('\n❌ Sync Failed:', e.message);
        if (e.message.includes('Error validating access token') || e.message.includes('Session has expired')) {
            console.error('👉 The Page Access Token is invalid/expired. Please Reconnect the page in Settings.');
        }
    } finally {
        await prisma.$disconnect();
    }
}

main();
