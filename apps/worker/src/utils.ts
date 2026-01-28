import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCODING = 'hex';
// KEY must be same as web. 
// We will use process.env.APP_ENCRYPTION_KEY which is loaded in index.ts
const KEY = process.env.APP_ENCRYPTION_KEY || '12345678901234567890123456789012';

export function decrypt(text: string) {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift() as string, ENCODING);
    const encryptedText = Buffer.from(textParts.join(':'), ENCODING);
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

export function parseTimeToMs(timeStr: string): number {
    if (!timeStr) return 0;
    const [value, unit] = timeStr.trim().split(' ');
    const num = parseInt(value);
    if (isNaN(num)) return 0;

    if (unit.startsWith('segundo')) return num * 1000;
    if (unit.startsWith('minuto')) return num * 60 * 1000;
    if (unit.startsWith('hora')) return num * 60 * 60 * 1000;
    if (unit.startsWith('dia')) return num * 24 * 60 * 60 * 1000;

    return num * 1000; // default seconds
}
