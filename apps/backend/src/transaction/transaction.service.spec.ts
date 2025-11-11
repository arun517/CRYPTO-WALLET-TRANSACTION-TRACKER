import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TransactionService } from './transaction.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { NetworkConfigService } from '../config/network.config';

describe('TransactionService', () => {
  let service: TransactionService;

  const mockPrismaService = {
    transaction: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    wallet: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'ETHEREUM_RPC_URL') {
        return 'https://eth-sepolia.g.alchemy.com/v2/test';
      }
      if (key === 'ETHERSCAN_API_KEY') {
        return 'test-key';
      }
      return null;
    }),
  };

  const mockNetworkConfigService = {
    getRpcUrl: jest.fn((chainId: number) => {
      return 'https://eth-sepolia.g.alchemy.com/v2/test';
    }),
    getEtherscanChainId: jest.fn((chainId: number) => {
      return chainId === 1 ? '1' : '11155111';
    }),
    getNetworkName: jest.fn((chainId: number) => {
      return chainId === 1 ? 'Mainnet' : 'Sepolia';
    }),
    getNetworkConfig: jest.fn((chainId: number) => {
      return {
        rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/test',
        etherscanChainId: chainId === 1 ? '1' : '11155111',
        name: chainId === 1 ? 'Mainnet' : 'Sepolia',
      };
    }),
    isSupportedNetwork: jest.fn((chainId: number) => {
      return chainId === 1 || chainId === 11155111;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: NetworkConfigService,
          useValue: mockNetworkConfigService,
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    // Clean up provider connections
    if (service && service['provider']) {
      try {
        service['provider'].destroy?.();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe('getTransactionByHash', () => {
    const hash =
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const mockCachedTx = {
      id: '1',
      hash,
      fromAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      toAddress: '0x456',
      amount: '1.0',
      blockNumber: BigInt(1000),
      gasUsed: BigInt(21000),
      gasPrice: BigInt(20000000000),
      timestamp: new Date('2024-01-01'),
      status: 'success',
      walletId: 'wallet-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return cached transaction', async () => {
      mockPrismaService.transaction.findFirst.mockResolvedValue(mockCachedTx);

      const result = await service.getTransactionByHash(hash);

      expect(result).toHaveProperty('hash', hash);
      expect(result).toHaveProperty('from', mockCachedTx.fromAddress);
      expect(result).toHaveProperty('to', mockCachedTx.toAddress);
    });

    it('should throw NotFoundException when transaction not found', async () => {
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      const mockProvider = {
        getTransaction: jest.fn().mockResolvedValue(null),
      };
      service['getProvider'] = jest.fn().mockReturnValue(mockProvider);

      await expect(service.getTransactionByHash(hash)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
