import { Router } from 'express'
import { requireJWT } from '../middleware/auth.middleware.js'
import { generateWarehouseReceiptPdf } from '../lib/pdf/certificate.js'
import type { TokenRecord } from '@farmledge/shared'

export const farmerRouter = Router()

farmerRouter.get('/farmers/:farmer_id/tokens', requireJWT, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — getFarmerTokens' })
})

farmerRouter.get('/farmers/:farmer_id/history', requireJWT, (req, res) => {
  res.status(200).json({ success: true, data: 'STUB — getFarmerHistory' })
})

farmerRouter.get('/certificates/:token_id', requireJWT, async (req, res) => {
  try {
    const tokenId = req.params.token_id
    if (!tokenId) {
      res.status(400).json({ success: false, error: 'Token ID is required' })
      return
    }

    const token: TokenRecord = {
      token_id: tokenId,
      farmer_id: 'FARMER-001',
      commodity: 'maize',
      grade: 'A',
      bag_count: 40,
      weight_per_bag_kg: 100,
      total_weight_kg: 4000,
      warehouse_id: 'WH-001',
      warehouse_name: 'Kano Central Warehouse',
      warehouse_certified: true,
      custodian_wallet: 'GABC1234567890',
      deposit_date: '2026-03-14T00:00:00.000Z',
      status: 'active',
      is_locked: false,
      tx_hash: 'abc123def456',
      stellar_explorer_link: 'https://stellar.expert/explorer/testnet/tx/abc123def456',
    }

    const pdfBuffer = await generateWarehouseReceiptPdf(token)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="warehouse-receipt-${tokenId}.pdf"`)
    res.status(200).send(pdfBuffer)
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate certificate' })
  }
})
