import { Commodity } from '@prisma/client'
import { z } from 'zod'

const commodityValues = Object.values(Commodity) as [string, ...string[]]

export const DepositSchema = z.object({
  farmerId: z.string({ required_error: 'farmerId is required' }).optional(),
  commodity: z.enum(commodityValues).optional(),
  grade: z.enum(['Grade A', 'Grade B', 'Grade C']).optional(),
  bagCount: z.number({ required_error: 'bagCount is required' }).int().positive().optional(),
  weightPerBagKg: z.number({ required_error: 'weightPerBagKg is required' }).positive().optional(),
  warehouseId: z.string({ required_error: 'warehouseId is required' }).optional(),
})