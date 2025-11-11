import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WalletService } from './wallet.service';
import { PrismaService } from '../prisma/prisma.service';
import { NetworkConfigService } from '../config/network.config';
import { ethers } from 'ethers';

describe('WalletService', () => {
  let service: WalletService;

  const mockPrismaService = {
    wallet: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
      createMany: jest.fn(),
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
        WalletService,
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

    service = module.get<WalletService>(WalletService);
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

  describe('getBalance', () => {
    it('should return balance for valid address', async () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      const mockBalance = ethers.parseEther('1.5');

      jest.spyOn(ethers, 'isAddress').mockReturnValue(true);
      const mockProvider = {
        getBalance: jest.fn().mockResolvedValue(mockBalance),
      };
      service['getProvider'] = jest.fn().mockReturnValue(mockProvider);
      mockPrismaService.wallet.upsert.mockResolvedValue({
        address: address.toLowerCase(),
      });

      const result = await service.getBalance(address);

      expect(result).toHaveProperty('balance');
      expect(result.balance).toBe('1.5');
      expect(mockPrismaService.wallet.upsert).toHaveBeenCalledWith({
        where: { address: address.toLowerCase() },
        update: { updatedAt: expect.any(Date) },
        create: { address: address.toLowerCase() },
      });
    });

    it('should throw error for invalid address', async () => {
      const invalidAddress = 'invalid-address';

      jest.spyOn(ethers, 'isAddress').mockReturnValue(false);

      await expect(service.getBalance(invalidAddress)).rejects.toThrow(
        'Invalid Ethereum address',
      );
    });
  });

  describe('getTransactions', () => {
    const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
    const mockTransactions = [
      {
        id: '1',
        hash: '0x123',
        fromAddress: address.toLowerCase(),
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
      },
    ];

    beforeEach(() => {
      jest.spyOn(ethers, 'isAddress').mockReturnValue(true);
    });

    it('should return cached transactions', async () => {
      mockPrismaService.wallet.findUnique.mockResolvedValue({
        id: 'wallet-1',
        address: address.toLowerCase(),
        transactions: mockTransactions,
      });

      const result = await service.getTransactions(
        address,
        undefined,
        20,
        1,
        11155111,
      );

      expect(result).toHaveProperty('transactions');
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].hash).toBe('0x123');
    });

    it('should filter by sent transactions', async () => {
      const receivedTx = {
        ...mockTransactions[0],
        fromAddress: '0x456',
        toAddress: address.toLowerCase(),
      };

      mockPrismaService.wallet.findUnique.mockResolvedValue({
        id: 'wallet-1',
        address: address.toLowerCase(),
        transactions: [mockTransactions[0], receivedTx],
      });

      const result = await service.getTransactions(
        address,
        'sent',
        20,
        1,
        11155111,
      );

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].from.toLowerCase()).toBe(
        address.toLowerCase(),
      );
    });

    it('should return empty array when no cached transactions', async () => {
      mockPrismaService.wallet.findUnique.mockResolvedValue(null);

      const result = await service.getTransactions(
        address,
        undefined,
        20,
        1,
        11155111,
      );

      expect(result.transactions).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
