export * from './custodian.schemas.js'
export * from './farmer.schemas.js'
export * from './lender.schemas.js'
export * from './upload.schemas.js'
import { z } from 'zod'

// TransferSchema is exported from farmer.schemas.js

export const LockSchema = z.object({
  lender_id: z
    .string({ required_error: 'lender_id is required' })
    .min(1, 'lender_id is required'),
  loan_reference: z
    .string({ required_error: 'loan_reference is required' })
    .min(1, 'loan_reference is required'),
})

export const SplitTokenSchema = z.object({
  split_amount_kg: z
    .number({ required_error: 'split_amount_kg is required' })
    .positive('split_amount_kg must be greater than 0'),
})

