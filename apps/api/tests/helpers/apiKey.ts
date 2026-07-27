import { createHash } from 'node:crypto'
import { seedApiKeyRecord } from '../../src/lib/db.js'

const DEFAULT_TEST_SALT = 'test-salt-key-minimum-32-characters-long'

export function hashApiKeyForTests(apiKey: string, salt = process.env.LENDER_API_KEY_SALT ?? DEFAULT_TEST_SALT): string {
  return createHash('sha256').update(`${salt}:${apiKey}`).digest('hex')
}

export async function createTestApiKeyHeader(): Promise<string> {
  const rawApiKey = `test-key-${Math.random().toString(36).slice(2, 10)}`
  const keyHash = hashApiKeyForTests(rawApiKey)

  seedApiKeyRecord({
    lenderId: 'test-lender-id',
    keyHash,
    label: 'test-key',
  })

  return rawApiKey
}
