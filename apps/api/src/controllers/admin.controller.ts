import { randomBytes, createHash } from 'node:crypto'
import { type Request, type Response } from 'express'
import { env } from '../config/env.js'
import { db } from '../lib/db.js'
import { created, badRequest, unauthorized, notFound, serverError } from '../utils/response.js'

/**
 * Hash a raw API key using the same algorithm as requireAPIKey middleware.
 * Format: SHA-256( LENDER_API_KEY_SALT + ':' + rawKey )
 */
function hashApiKey(rawKey: string): string {
  const salt = env.LENDER_API_KEY_SALT
  return createHash('sha256').update(`${salt}:${rawKey}`).digest('hex')
}

/**
 * POST /api/v1/admin/lenders/:id/api-keys
 *
 * Admin-only endpoint (requires X-Admin-Secret header).
 * Generates a cryptographically random API key for the specified lender,
 * stores only its SHA-256 hash, and returns the plaintext key exactly once.
 *
 * Request headers:
 *   X-Admin-Secret: <PLATFORM_ADMIN_SECRET>
 *
 * Request body (optional):
 *   { "label": "string" }   — human-readable label for the key (defaults to "api-key")
 *
 * Response 201:
 *   { success: true, data: { apiKey: string, keyId: string, lenderId: string, label: string, createdAt: string } }
 *
 * The raw `apiKey` is returned exactly once and is never stored. Only the
 * hash is persisted. There is no way to retrieve the plaintext key again.
 */
export async function generateApiKey(req: Request, res: Response): Promise<void> {
  // 1. Authenticate the caller
  const adminSecret = req.headers['x-admin-secret']
  const secret = Array.isArray(adminSecret) ? adminSecret[0] : adminSecret

  if (!secret || secret !== env.PLATFORM_ADMIN_SECRET) {
    unauthorized(res)
    return
  }

  const { id: lenderId } = req.params

  if (!lenderId) {
    badRequest(res, 'Lender ID is required')
    return
  }

  // Optional label from request body
  const label: string =
    (req.body as { label?: string } | undefined)?.label?.trim() || 'api-key'

  try {
    // 2. Verify the lender exists
    const lender = await db.lender.findUnique({ where: { id: lenderId } })

    if (!lender) {
      notFound(res, `Lender ${lenderId} not found`)
      return
    }

    // 3. Generate a cryptographically random 32-byte key, hex-encoded (64 chars)
    const rawKey = randomBytes(32).toString('hex')

    // 4. Hash the key — only the hash is stored
    const keyHash = hashApiKey(rawKey)

    // 5. Persist the hash record
    const record = await db.apiKey.create({
      data: {
        lenderId,
        keyHash,
        label,
      },
    })

    // 6. Return the plaintext key exactly once — it is never retrievable again
    created(res, {
      apiKey: rawKey,
      keyId: record.id,
      lenderId: record.lenderId,
      label: record.label,
      createdAt: record.createdAt,
    })
  } catch (err) {
    serverError(res, 'Failed to generate API key')
  }
}
