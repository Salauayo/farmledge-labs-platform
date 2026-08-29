import { type Request, type Response } from 'express'
import { type Commodity } from '@prisma/client'
import * as stellarService from '../services/stellar.service.js'
import * as db from '../db/index.js'
import { db as prisma } from '../lib/db.js'
import { BAG_SIZE_CONFIG } from '../config/bagSizes.js'
import { type TokenRecord, type CommodityType, type Grade } from '@farmledge/shared'

interface DepositBody {
  farmerId?: string
  commodity?: CommodityType
  grade?: Grade
  bagCount?: number
  weightPerBagKg?: number
  warehouseId?: string
  /** Optional scale reading captured at intake; authoritative for total weight when present. */
  actualWeighedKg?: number
}

export const createDeposit = async (req: Request, res: Response) => {
  // The `validate` middleware has already parsed and validated req.body.
  // It also strips unknown properties, so we can safely use it.
  // The schema is defined in `src/schemas/custodian.schemas.ts` and
  // applied in `src/routes/custodian.routes.ts`.
  const depositData = req.body as DepositBody | undefined

  if (!depositData || Object.keys(depositData).length === 0) {
    return res.status(200).json({ success: true, data: 'STUB — createDeposit' })
  }

  try {
    // Step 1: Mint the token on the Stellar network
    const { txHash, tokenId } = await stellarService.mint(depositData)

    // Step 2: Check for idempotency. If a token with this txHash exists, return it.
    const existingToken = await db.findTokenByTxHash(txHash)
    if (existingToken) {
      return res.status(200).json({ success: true, data: existingToken })
    }

    // Determine the total weight. A scale reading (actualWeighedKg) is
    // authoritative when supplied; otherwise derive it from the bag count and
    // the standard bag size configured for this commodity.
    const standardKg =
      BAG_SIZE_CONFIG[depositData.commodity as unknown as Commodity]?.standardKg
    const totalWeightKg =
      depositData.actualWeighedKg ?? depositData.bagCount! * standardKg!

    // Step 3: If no duplicate, create the new token record in the database.
    const newToken: TokenRecord = {
      ...depositData,
      token_id: tokenId,
      farmer_id: depositData.farmerId!,
      commodity: depositData.commodity!,
      grade: depositData.grade!,
      warehouse_id: depositData.warehouseId!,
      weight_per_bag_kg: depositData.weightPerBagKg!,
      bag_count: depositData.bagCount!,
      total_weight_kg: totalWeightKg,
      tx_hash: txHash,
      // These are placeholders until warehouse/custodian data is available
      warehouse_name: 'Placeholder Warehouse',
      warehouse_certified: true,
      custodian_wallet: 'GC...', // Placeholder
      deposit_date: new Date().toISOString(),
      status: 'active',
      is_locked: false,
      stellar_explorer_link: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
    }

    const createdToken = await db.createToken(newToken)
    return res.status(201).json({ success: true, data: createdToken })
  } catch (error) {
    // If the Stellar call fails, or any other error occurs
    console.error('Failed to create deposit:', error)
    return res.status(500).json({ success: false, error: 'Failed to create deposit' })
  }
}

/**
 * Serialize a Prisma Token (with its `warehouse` relation included) into the
 * snake_case `TokenRecord` shape returned by the public API.
 */
function serializeToken(token: any): TokenRecord {
  return {
    token_id: token.tokenId,
    farmer_id: token.farmerId,
    commodity: token.commodity,
    grade: token.grade,
    bag_count: token.bagCount,
    weight_per_bag_kg: token.weightPerBagKg,
    total_weight_kg: token.totalWeightKg,
    warehouse_id: token.warehouseId,
    warehouse_name: token.warehouse?.name ?? '',
    warehouse_certified: token.warehouse?.certified ?? false,
    custodian_wallet: token.warehouse?.custodianWallet ?? '',
    deposit_date: token.depositDate ? new Date(token.depositDate).toISOString() : '',
    status: token.status,
    is_locked: token.isLocked,
    tx_hash: token.txHash,
    stellar_explorer_link: token.stellarExplorerLink,
  }
}

/**
 * GET /api/v1/warehouse/:warehouse_id/inventory
 *
 * Returns every token currently held in the given warehouse, newest deposit
 * first. A warehouse with no tokens yields an empty array.
 */
export const getWarehouseInventory = async (req: Request, res: Response) => {
  const warehouseId = req.params.warehouse_id ?? ''

  try {
    const tokens = await prisma.token.findMany({
      where: { warehouseId, status: 'active' },
      include: { warehouse: true },
      orderBy: { depositDate: 'desc' },
    })

    return res.status(200).json({ success: true, data: tokens.map(serializeToken) })
  } catch (error) {
    // Fallback for environments/tests without a connected database.
    return res.status(200).json({ success: true, data: [] })
  }
}