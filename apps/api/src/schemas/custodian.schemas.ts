import { Commodity } from '@prisma/client';
import { z } from 'zod';

const commodityValues = Object.values(Commodity) as [string, ...string[]];

export const DepositSchema = z.object({
  farmerId: z.string({ required_error: 'farmerId is required' }).optional(),
  commodity: z.enum(commodityValues).optional(),
  grade: z.enum(['Grade A', 'Grade B', 'Grade C']).optional(),
  bagCount: z.number({ required_error: 'bagCount is required' }).int().positive().optional(),
  weightPerBagKg: z.number({ required_error: 'weightPerBagKg is required' }).positive().optional(),
  warehouseId: z.string({ required_error: 'warehouseId is required' }).optional(),
  // Optional scale reading captured at intake. When present it is authoritative
  // for total weight; otherwise total weight is derived from the standard bag size.
  actualWeighedKg: z.number().positive().optional(),
});

export const OnboardCustodianSchema = z.object({
  name: z.string({ required_error: 'name is required' }).min(1, 'name is required'),
  location: z.string({ required_error: 'location is required' }).min(1, 'location is required'),
  state: z.string({ required_error: 'state is required' }).min(1, 'state is required'),
  certified: z.boolean().optional().default(false),
  capacityTonnes: z
    .number({ required_error: 'capacityTonnes is required' })
    .positive('capacityTonnes must be positive')
    .optional(),
  capacity_tonnes: z.number().positive().optional(),
  custodianWallet: z.string().optional(),
  custodian_wallet: z.string().optional(),
});

export const ExitSchema = z.object({
  exit_reason: z.string().min(1, 'exit_reason is required'),
  delivery_note_number: z.string().min(1, 'delivery_note_number is required'),
});
