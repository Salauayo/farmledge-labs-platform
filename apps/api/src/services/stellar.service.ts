type MintResult = {
  txHash: string
  tokenId: string
}

export const mint = async (_depositData: unknown): Promise<MintResult> => {
  return {
    txHash: 'mock-tx-hash',
    tokenId: 'mock-token-id',
  }
}

export const farmerWalletSigner = {
  signAsFarmer: async (): Promise<string> => {
    return 'mock-farmer-signature'
  }
}
