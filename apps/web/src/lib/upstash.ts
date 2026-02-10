import { Redis } from '@upstash/redis'
import { Client } from '@upstash/qstash'

const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
const qstashToken = process.env.QSTASH_TOKEN

export const redis = new Redis({
    url: redisUrl || 'https://mock.upstash.io',
    token: redisToken || 'mock_token',
})

// QStash client is optional locally but needed for better reliability in Vercel
export const qstash = qstashToken ? new Client({ token: qstashToken }) : null
