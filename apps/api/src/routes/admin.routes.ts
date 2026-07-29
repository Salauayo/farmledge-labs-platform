import { Router } from 'express'
import { generateApiKey } from '../controllers/admin.controller.js'

export const adminRouter = Router()

/**
 * POST /api/v1/admin/lenders/:id/api-keys
 *
 * Generates a new API key for the given lender.
 * Requires the X-Admin-Secret header to match PLATFORM_ADMIN_SECRET.
 * Authentication is handled inside the controller so error messages
 * are consistent with the rest of the API response shape.
 */
adminRouter.post('/admin/lenders/:id/api-keys', generateApiKey)
