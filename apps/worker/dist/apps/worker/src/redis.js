"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.instagramQueue = exports.connection = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const bullmq_1 = require("bullmq");
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
exports.connection = new ioredis_1.default(redisUrl, {
    maxRetriesPerRequest: null,
});
exports.instagramQueue = new bullmq_1.Queue('instagram-events', { connection: exports.connection });
