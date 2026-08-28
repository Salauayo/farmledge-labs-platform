import { randomUUID } from 'node:crypto'

export type TestFarmer = {
  id: string
  fullName: string
  phone: string
  pinHash: string
  stellarWallet: string
  bvnVerified: boolean
  createdAt: Date
  updatedAt: Date
}

export type TestWarehouse = {
  id: string
  name: string
  location: string
  state: string
  certified: boolean
  capacityTonnes: number
  custodianWallet: string
  createdAt: Date
  updatedAt: Date
}

export type TestToken = {
  id: string
  tokenId: string
  commodity: string
  grade: string
  bagCount: number
  weightPerBagKg: number
  totalWeightKg: number
  status: 'active' | 'transferred' | 'exited'
  isLocked: boolean
  lockedByLenderId: string | null
  loanReference: string | null
  txHash: string
  stellarExplorerLink: string
  depositDate: Date
  exitDate: Date | null
  createdAt: Date
  updatedAt: Date
  farmerId: string
  warehouseId: string
  parentTokenId: string | null
}

export type TestActivity = {
  id: string
  farmerId: string
  type: string
  tokenId: string
  createdAt: Date
  metadata?: Record<string, unknown>
}

export type TestDatabase = {
  farmer: {
    findUnique(args: { where: { phone?: string; id?: string } }): Promise<TestFarmer | null>
    create(args: { data: TestFarmer }): Promise<TestFarmer>
  }
  token: {
    findMany(args: { where?: { farmerId?: string }; orderBy?: { depositDate: 'desc' }; include?: { warehouse: boolean } }): Promise<Array<TestToken & { warehouse?: TestWarehouse }>>
    findFirst(args: { where?: { OR?: Array<{ id?: string; tokenId?: string }> } }): Promise<TestToken | null>
    update(args: { where: { id: string }; data: Partial<TestToken> }): Promise<TestToken>
    create(args: { data: TestToken }): Promise<TestToken>
  }
  activity: {
    findMany(args: { where: { farmerId: string }; orderBy?: { createdAt: 'desc' } }): Promise<TestActivity[]>
  }
  $transaction<T>(operations: Promise<T>[]): Promise<T[]>
}

const state = {
  farmers: new Map<string, TestFarmer>(),
  warehouses: new Map<string, TestWarehouse>(),
  tokens: new Map<string, TestToken>(),
  activities: new Map<string, TestActivity>(),
}

function tokenWithWarehouse(token: TestToken): TestToken & { warehouse: TestWarehouse | undefined } {
  return { ...token, warehouse: state.warehouses.get(token.warehouseId) }
}

export function resetTestDatabase(): void {
  state.farmers.clear()
  state.warehouses.clear()
  state.tokens.clear()
  state.activities.clear()
}

export function seedTestWarehouse(input: Partial<TestWarehouse> = {}): TestWarehouse {
  const now = new Date()
  const warehouse: TestWarehouse = {
    id: input.id ?? `warehouse-${randomUUID()}`,
    name: input.name ?? 'Kano Test Warehouse',
    location: input.location ?? 'Fagge LGA',
    state: input.state ?? 'Kano',
    certified: input.certified ?? true,
    capacityTonnes: input.capacityTonnes ?? 5000,
    custodianWallet: input.custodianWallet ?? 'GTESTCUSTODIAN',
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  }
  state.warehouses.set(warehouse.id, warehouse)
  return warehouse
}

export function seedTestToken(input: Partial<TestToken> & Pick<TestToken, 'farmerId' | 'warehouseId' | 'tokenId'>): TestToken {
  const now = new Date()
  const token: TestToken = {
    id: input.id ?? `token-${randomUUID()}`,
    tokenId: input.tokenId,
    commodity: input.commodity ?? 'MAIZE_WHITE',
    grade: input.grade ?? 'Grade_A',
    bagCount: input.bagCount ?? 40,
    weightPerBagKg: input.weightPerBagKg ?? 100,
    totalWeightKg: input.totalWeightKg ?? 4000,
    status: input.status ?? 'active',
    isLocked: input.isLocked ?? false,
    lockedByLenderId: input.lockedByLenderId ?? null,
    loanReference: input.loanReference ?? null,
    txHash: input.txHash ?? `tx-${randomUUID()}`,
    stellarExplorerLink: input.stellarExplorerLink ?? 'https://stellar.expert/explorer/testnet/tx/test',
    depositDate: input.depositDate ?? now,
    exitDate: input.exitDate ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    farmerId: input.farmerId,
    warehouseId: input.warehouseId,
    parentTokenId: input.parentTokenId ?? null,
  }
  state.tokens.set(token.id, token)
  return token
}

export function seedTestActivity(input: Omit<TestActivity, 'id'> & { id?: string }): TestActivity {
  const activity = { ...input, id: input.id ?? `activity-${randomUUID()}` }
  state.activities.set(activity.id, activity)
  return activity
}

export function createTestDatabase(): TestDatabase {
  return {
    farmer: {
      async findUnique({ where }) {
        return [...state.farmers.values()].find((farmer) =>
          (where.phone && farmer.phone === where.phone) || (where.id && farmer.id === where.id),
        ) ?? null
      },
      async create({ data }) {
        state.farmers.set(data.id, data)
        return data
      },
    },
    token: {
      async findMany({ where, orderBy, include }) {
        const tokens = [...state.tokens.values()]
          .filter((token) => !where?.farmerId || token.farmerId === where.farmerId)
          .sort((left, right) => orderBy?.depositDate === 'desc'
            ? right.depositDate.getTime() - left.depositDate.getTime()
            : 0)
        return include?.warehouse ? tokens.map(tokenWithWarehouse) : tokens
      },
      async findFirst({ where }) {
        return [...state.tokens.values()].find((token) => where?.OR?.some((candidate) =>
          candidate.id === token.id || candidate.tokenId === token.tokenId,
        )) ?? null
      },
      async update({ where, data }) {
        const token = state.tokens.get(where.id)
        if (!token) throw new Error('Token not found')
        const updated = { ...token, ...data, updatedAt: new Date() }
        state.tokens.set(token.id, updated)
        return updated
      },
      async create({ data }) {
        state.tokens.set(data.id, data)
        return data
      },
    },
    activity: {
      async findMany({ where, orderBy }) {
        return [...state.activities.values()]
          .filter((activity) => activity.farmerId === where.farmerId)
          .sort((left, right) => orderBy?.createdAt === 'desc'
            ? right.createdAt.getTime() - left.createdAt.getTime()
            : 0)
      },
    },
    async $transaction(operations) {
      return Promise.all(operations)
    },
  }
}

export function installTestDatabase(database = createTestDatabase()): TestDatabase {
  ;(globalThis as unknown as { prisma: TestDatabase }).prisma = database
  return database
}

export function getTestToken(tokenId: string): TestToken | undefined {
  return [...state.tokens.values()].find((token) => token.tokenId === tokenId)
}
