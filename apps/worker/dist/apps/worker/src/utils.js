"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decrypt = decrypt;
exports.parseTimeToMs = parseTimeToMs;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = 'aes-256-cbc';
const ENCODING = 'hex';
// KEY must be same as web. 
// We will use process.env.APP_ENCRYPTION_KEY which is loaded in index.ts
const KEY = process.env.APP_ENCRYPTION_KEY || '12345678901234567890123456789012';
function decrypt(text) {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), ENCODING);
    const encryptedText = Buffer.from(textParts.join(':'), ENCODING);
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, Buffer.from(KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
function parseTimeToMs(timeStr) {
    if (!timeStr)
        return 0;
    const [value, unit] = timeStr.trim().split(' ');
    const num = parseInt(value);
    if (isNaN(num))
        return 0;
    if (unit.startsWith('segundo'))
        return num * 1000;
    if (unit.startsWith('minuto'))
        return num * 60 * 1000;
    if (unit.startsWith('hora'))
        return num * 60 * 60 * 1000;
    if (unit.startsWith('dia'))
        return num * 24 * 60 * 60 * 1000;
    return num * 1000; // default seconds
}
