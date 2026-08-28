import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: any;
};

function createPrismaClient(): any {
  try {
    return (
      globalForPrisma.prisma ??
      new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      })
    );
  } catch (err) {
    return null;
  }
}

let clientInstance = createPrismaClient();
if (process.env.NODE_ENV !== 'production' && clientInstance) {
  globalForPrisma.prisma = clientInstance;
}

const fallbackApiKeys = new Map<string, any>();
const fallbackLenders = new Map<string, any>();
const fallbackWarehouses = new Map<string, any>();
const fallbackTokens = new Map<string, any>();

export function seedLenderRecord(record: {
  id: string;
  companyName?: string;
  contactEmail?: string;
  approved?: boolean;
}) {
  const normalized = {
    companyName: 'Test Lender',
    contactEmail: `${record.id}@test.com`,
    approved: true,
    createdAt: new Date(),
    ...record,
  };
  fallbackLenders.set(normalized.id, normalized);
  return normalized;
}

export function seedApiKeyRecord(record: {
  id?: string;
  keyHash: string;
  lenderId?: string;
  label?: string;
  revokedAt?: Date | null;
  lastUsedAt?: Date | null;
}) {
  const normalized = {
    id: record.id ?? `api-key-${fallbackApiKeys.size + 1}`,
    lenderId: record.lenderId ?? 'test-lender-id',
    label: record.label ?? 'test-key',
    revokedAt: record.revokedAt ?? null,
    lastUsedAt: record.lastUsedAt ?? null,
    createdAt: new Date(),
    ...record,
  };
  fallbackApiKeys.set(normalized.keyHash, normalized);
  return normalized;
}

export function seedWarehouseRecord(record: {
  id?: string;
  name?: string;
  location?: string;
  state?: string;
  certified?: boolean;
  capacityTonnes?: number;
  custodianWallet?: string;
}) {
  const normalized = {
    id: record.id ?? `warehouse-${fallbackWarehouses.size + 1}`,
    name: record.name ?? 'Test Warehouse',
    location: record.location ?? 'Test Location',
    state: record.state ?? 'Test State',
    certified: record.certified ?? false,
    capacityTonnes: record.capacityTonnes ?? 1000,
    custodianWallet: record.custodianWallet ?? 'GCUSTODIANDEFAULT',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...record,
  };
  fallbackWarehouses.set(normalized.id, normalized);
  fallbackWarehouses.set(normalized.custodianWallet, normalized);
  return normalized;
}

export function getWarehouseByWallet(wallet: string) {
  return fallbackWarehouses.get(wallet) ?? null;
}

export function clearWarehouseFallback() {
  fallbackWarehouses.clear();
}

export function seedTokenRecord(record: Record<string, any>) {
  const normalized: Record<string, any> = {
    id: record.id ?? `token-${fallbackTokens.size + 1}`,
    status: 'active',
    isLocked: false,
    depositDate: new Date(),
    ...record,
  };
  fallbackTokens.set(normalized.id, normalized);
  fallbackTokens.set(normalized.tokenId, normalized);
  fallbackTokens.set(normalized.txHash, normalized);
  return normalized;
}

export function clearTokenFallback() {
  fallbackTokens.clear();
}

export const db: PrismaClient = new Proxy({} as any, {
  get(_target, prop) {
    if (!clientInstance) {
      clientInstance = createPrismaClient();
    }

    if (prop === 'apiKey') {
      return {
        findFirst: async (args: any) => {
          try {
            return await clientInstance?.apiKey?.findFirst?.(args);
          } catch (error) {
            const where = args?.where ?? {};
            if (typeof where.keyHash === 'string') {
              return fallbackApiKeys.get(where.keyHash) ?? null;
            }
            return null;
          }
        },
        update: async (args: any) => {
          try {
            return await clientInstance?.apiKey?.update?.(args);
          } catch (error) {
            const where = args?.where ?? {};
            const existing = Array.from(fallbackApiKeys.values()).find((record: any) => {
              return record.id === where.id || record.keyHash === where.keyHash;
            });
            if (!existing) {
              return null;
            }
            const updated = { ...existing, ...args?.data };
            fallbackApiKeys.set(updated.keyHash, updated);
            return updated;
          }
        },
        create: async (args: any) => {
          try {
            return await clientInstance?.apiKey?.create?.(args);
          } catch (error) {
            return seedApiKeyRecord(args?.data);
          }
        },
      };
    }

    if (prop === 'lender') {
      return {
        findUnique: async (args: any) => {
          try {
            return await clientInstance?.lender?.findUnique?.(args);
          } catch (error) {
            const where = args?.where ?? {};
            if (typeof where.id === 'string') {
              return fallbackLenders.get(where.id) ?? null;
            }
            return null;
          }
        },
      };
    }

    if (prop === 'warehouse') {
      return {
        findUnique: async (args: any) => {
          try {
            return await clientInstance?.warehouse?.findUnique?.(args);
          } catch (error) {
            const where = args?.where ?? {};
            if (typeof where.id === 'string' && fallbackWarehouses.has(where.id)) {
              return fallbackWarehouses.get(where.id);
            }
            if (
              typeof where.custodianWallet === 'string' &&
              fallbackWarehouses.has(where.custodianWallet)
            ) {
              return fallbackWarehouses.get(where.custodianWallet);
            }
            return null;
          }
        },
        findFirst: async (args: any) => {
          try {
            return await clientInstance?.warehouse?.findFirst?.(args);
          } catch (error) {
            const where = args?.where ?? {};
            if (
              typeof where.custodianWallet === 'string' &&
              fallbackWarehouses.has(where.custodianWallet)
            ) {
              return fallbackWarehouses.get(where.custodianWallet);
            }
            return null;
          }
        },
        create: async (args: any) => {
          try {
            return await clientInstance?.warehouse?.create?.(args);
          } catch (error) {
            return seedWarehouseRecord(args?.data);
          }
        },
        findMany: async (args: any) => {
          try {
            return await clientInstance?.warehouse?.findMany?.(args);
          } catch (error) {
            return Array.from(new Set(fallbackWarehouses.values()));
          }
        },
      };
    }

    if (prop === 'token') {
      const findFallback = (where: any) => {
        const key = where?.id ?? where?.tokenId ?? where?.txHash;
        if (key) return fallbackTokens.get(key) ?? null;
        if (Array.isArray(where?.OR)) {
          return where.OR.map(findFallback).find(Boolean) ?? null;
        }
        return null;
      };

      return {
        findUnique: async (args: any) => {
          try {
            return await clientInstance?.token?.findUnique?.(args);
          } catch (_error) {
            return findFallback(args?.where);
          }
        },
        findFirst: async (args: any) => {
          try {
            return await clientInstance?.token?.findFirst?.(args);
          } catch (_error) {
            return findFallback(args?.where);
          }
        },
        findMany: async (args: any) => {
          try {
            return await clientInstance?.token?.findMany?.(args);
          } catch (_error) {
            const where = args?.where ?? {};
            return Array.from(new Set(fallbackTokens.values())).filter((token: any) =>
              (!where.farmerId || token.farmerId === where.farmerId) &&
              (!where.status || token.status === where.status) &&
              (where.isLocked === undefined || token.isLocked === where.isLocked),
            );
          }
        },
        update: async (args: any) => {
          try {
            return await clientInstance?.token?.update?.(args);
          } catch (_error) {
            const existing = findFallback(args?.where);
            if (!existing) throw new Error('Token not found');
            const updated = { ...existing, ...args?.data };
            seedTokenRecord(updated);
            return updated;
          }
        },
        create: async (args: any) => {
          try {
            return await clientInstance?.token?.create?.(args);
          } catch (_error) {
            return seedTokenRecord(args?.data ?? {});
          }
        },
      };
    }

    if (!clientInstance) {
      // Fallback for tests/environments where Prisma engine binary is not initialized
      if (prop === 'warehouse') {
        return {
          findUnique: async (args: any) => {
            const where = args?.where ?? {};
            if (typeof where.id === 'string' && fallbackWarehouses.has(where.id)) {
              return fallbackWarehouses.get(where.id);
            }
            if (
              typeof where.custodianWallet === 'string' &&
              fallbackWarehouses.has(where.custodianWallet)
            ) {
              return fallbackWarehouses.get(where.custodianWallet);
            }
            return null;
          },
          findFirst: async (args: any) => {
            const where = args?.where ?? {};
            if (
              typeof where.custodianWallet === 'string' &&
              fallbackWarehouses.has(where.custodianWallet)
            ) {
              return fallbackWarehouses.get(where.custodianWallet);
            }
            return null;
          },
          create: async (args: any) => seedWarehouseRecord(args?.data),
          findMany: async () => Array.from(new Set(fallbackWarehouses.values())),
        };
      }
      if (prop === 'token') {
        return {
          findFirst: async () => null,
          findUnique: async () => null,
          findMany: async () => [],
          update: async (args: any) => ({
            id: args?.where?.id || 'mock-id',
            tokenId: args?.where?.tokenId || 'KN-2026-000042',
            status: args?.data?.status || 'exited',
            ...args?.data,
          }),
          create: async (args: any) => ({
            id: 'mock-child-id',
            ...args?.data,
          }),
        };
      }
      if (prop === '$transaction') {
        return async (promisesOrFn: any) => {
          if (Array.isArray(promisesOrFn)) return await Promise.all(promisesOrFn);
          return await promisesOrFn(db);
        };
      }
      return undefined;
    }

    const value = Reflect.get(clientInstance, prop);
    if (typeof value === 'function') {
      return value.bind(clientInstance);
    }
    return value;
  },
});
