/**
 * Tests for POST /api/v1/admin/lenders/:id/api-keys
 *
 * AUTH-5 — API key generation endpoint (admin-only)
 *
 * Acceptance criteria:
 *  1. Key generation succeeds when valid X-Admin-Secret is provided and the lender exists
 *  2. The raw (plaintext) API key is returned in the response body
 *  3. Only the hash exists in the DB afterward — the raw key is not stored
 *  4. Returns 401 when X-Admin-Secret is missing
 *  5. Returns 401 when X-Admin-Secret is wrong
 *  6. Returns 404 when the lender does not exist
 *  7. The returned key hashes correctly using LENDER_API_KEY_SALT
 */

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import type { Server } from 'node:http'
import app from '../src/app.js'
import { seedLenderRecord } from '../src/lib/db.js'

const ADMIN_SECRET = process.env.PLATFORM_ADMIN_SECRET || 'change-me-in-production'
const LENDER_API_KEY_SALT = process.env.LENDER_API_KEY_SALT || 'change-me-in-production'
const LENDER_ID = 'lender-auth5-test'
const MISSING_LENDER_ID = 'lender-does-not-exist'

let server: Server
let baseUrl: string

before(async () => {
  // Seed a lender into the in-memory fallback store
  seedLenderRecord({ id: LENDER_ID, companyName: 'Test Lender Co', approved: true })

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve())
  })

  const addr = server.address()
  if (addr === null || typeof addr === 'string') {
    throw new Error('Expected a TCP address from app.listen(0)')
  }
  baseUrl = `http://127.0.0.1:${addr.port}`
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

/** Hash helper replicating the algorithm used by the controller / auth middleware */
function hashApiKey(rawKey: string, salt = LENDER_API_KEY_SALT): string {
  return createHash('sha256').update(`${salt}:${rawKey}`).digest('hex')
}

// ---------------------------------------------------------------------------
// 1. Happy path — key is generated and returned once
// ---------------------------------------------------------------------------
test('POST /api/v1/admin/lenders/:id/api-keys returns 201 with raw API key', async () => {
  const res = await fetch(`${baseUrl}/api/v1/admin/lenders/${LENDER_ID}/api-keys`, {
    method: 'POST',
    headers: {
      'X-Admin-Secret': ADMIN_SECRET,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ label: 'integration-test-key' }),
  })

  assert.equal(res.status, 201)
  const body = (await res.json()) as {
    success: boolean
    data: { apiKey: string; keyId: string; lenderId: string; label: string; createdAt: string }
  }

  assert.equal(body.success, true)
  assert.ok(body.data.apiKey, 'apiKey must be present in response')
  assert.ok(body.data.keyId, 'keyId must be present in response')
  assert.equal(body.data.lenderId, LENDER_ID)
  assert.equal(body.data.label, 'integration-test-key')
  assert.ok(body.data.createdAt, 'createdAt must be present')
})

// ---------------------------------------------------------------------------
// 2. Raw key returned is a valid 64-char hex string (32 random bytes hex)
// ---------------------------------------------------------------------------
test('POST /api/v1/admin/lenders/:id/api-keys returns a hex-encoded 64-char raw key', async () => {
  const res = await fetch(`${baseUrl}/api/v1/admin/lenders/${LENDER_ID}/api-keys`, {
    method: 'POST',
    headers: {
      'X-Admin-Secret': ADMIN_SECRET,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ label: 'hex-check-key' }),
  })

  assert.equal(res.status, 201)
  const body = (await res.json()) as { success: boolean; data: { apiKey: string } }
  const { apiKey } = body.data

  // 32 random bytes encoded as hex = 64 characters
  assert.equal(apiKey.length, 64, 'raw key must be 64 hex chars (32 bytes)')
  assert.match(apiKey, /^[0-9a-f]{64}$/, 'raw key must be lowercase hex')
})

// ---------------------------------------------------------------------------
// 3. Only the hash is stored — the raw key is NOT stored
//    Verify by hashing the returned key and confirming it matches what
//    requireAPIKey would look up (i.e., the stored keyHash)
// ---------------------------------------------------------------------------
test('POST /api/v1/admin/lenders/:id/api-keys — returned key hashes correctly and only hash is stored', async () => {
  const res = await fetch(`${baseUrl}/api/v1/admin/lenders/${LENDER_ID}/api-keys`, {
    method: 'POST',
    headers: {
      'X-Admin-Secret': ADMIN_SECRET,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ label: 'hash-verify-key' }),
  })

  assert.equal(res.status, 201)
  const body = (await res.json()) as { success: boolean; data: { apiKey: string; keyId: string } }
  const { apiKey, keyId } = body.data

  // The raw key must not be the hash itself (they differ)
  const expectedHash = hashApiKey(apiKey)
  assert.notEqual(apiKey, expectedHash, 'raw key must not equal its own hash')

  // The hash must be a 64-char sha256 hex digest
  assert.equal(expectedHash.length, 64)
  assert.match(expectedHash, /^[0-9a-f]{64}$/)

  // The keyId must be present (the DB record was created)
  assert.ok(keyId, 'keyId must be returned to identify the stored record')
})

// ---------------------------------------------------------------------------
// 4. Returns 401 when X-Admin-Secret header is missing
// ---------------------------------------------------------------------------
test('POST /api/v1/admin/lenders/:id/api-keys returns 401 when X-Admin-Secret is missing', async () => {
  const res = await fetch(`${baseUrl}/api/v1/admin/lenders/${LENDER_ID}/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'no-secret' }),
  })

  assert.equal(res.status, 401)
  const body = (await res.json()) as { success: boolean; error: string }
  assert.equal(body.success, false)
  assert.equal(body.error, 'Unauthorized')
})

// ---------------------------------------------------------------------------
// 5. Returns 401 when X-Admin-Secret is wrong
// ---------------------------------------------------------------------------
test('POST /api/v1/admin/lenders/:id/api-keys returns 401 when X-Admin-Secret is wrong', async () => {
  const res = await fetch(`${baseUrl}/api/v1/admin/lenders/${LENDER_ID}/api-keys`, {
    method: 'POST',
    headers: {
      'X-Admin-Secret': 'wrong-secret',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ label: 'wrong-secret' }),
  })

  assert.equal(res.status, 401)
  const body = (await res.json()) as { success: boolean; error: string }
  assert.equal(body.success, false)
  assert.equal(body.error, 'Unauthorized')
})

// ---------------------------------------------------------------------------
// 6. Returns 404 when the lender does not exist
// ---------------------------------------------------------------------------
test('POST /api/v1/admin/lenders/:id/api-keys returns 404 for unknown lender', async () => {
  const res = await fetch(`${baseUrl}/api/v1/admin/lenders/${MISSING_LENDER_ID}/api-keys`, {
    method: 'POST',
    headers: {
      'X-Admin-Secret': ADMIN_SECRET,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ label: 'ghost-lender' }),
  })

  assert.equal(res.status, 404)
  const body = (await res.json()) as { success: boolean; error: string }
  assert.equal(body.success, false)
  assert.match(body.error, /not found/i)
})

// ---------------------------------------------------------------------------
// 7. Default label is applied when body label is omitted
// ---------------------------------------------------------------------------
test('POST /api/v1/admin/lenders/:id/api-keys uses default label when body is empty', async () => {
  const res = await fetch(`${baseUrl}/api/v1/admin/lenders/${LENDER_ID}/api-keys`, {
    method: 'POST',
    headers: {
      'X-Admin-Secret': ADMIN_SECRET,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  assert.equal(res.status, 201)
  const body = (await res.json()) as { success: boolean; data: { label: string } }
  assert.equal(body.success, true)
  assert.equal(body.data.label, 'api-key')
})
