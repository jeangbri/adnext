// import 'server-only'; // Disabled for worker compatibility
if (typeof window !== 'undefined') {
    // throw new Error('This file should not be imported on the client.');
}
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCODING = 'hex';
const IV_LENGTH = 16;
const KEY = process.env.APP_ENCRYPTION_KEY || '12345678901234567890123456789012'; // Default for dev, must be 32 chars

export function encrypt(text: string) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString(ENCODING) + ':' + encrypted.toString(ENCODING);
}

export function decrypt(text: string) {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift() as string, ENCODING);
    const encryptedText = Buffer.from(textParts.join(':'), ENCODING);
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
