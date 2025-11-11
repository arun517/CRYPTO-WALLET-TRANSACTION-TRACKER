import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ethers } from 'ethers';
import { TransactionResponse } from '@crypto-wallet-tracker/types';
import { ETHERSCAN_CONFIG } from '@crypto-wallet-tracker/config';
import { NetworkConfigService } from '../config/network.config';

@Injectable()
export class WalletService {
  private etherscanApiKey: string | null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private networkConfig: NetworkConfigService,
  ) {
    this.etherscanApiKey =
      this.configService.get<string>('ETHERSCAN_API_KEY') || null;
  }

  private getProvider(chainId: number): ethers.JsonRpcProvider {
    const rpcUrl = this.networkConfig.getRpcUrl(chainId);
    return new ethers.JsonRpcProvider(rpcUrl);
  }

  async getBalance(
    address: string,
    chainId: number = 11155111,
  ): Promise<{ balance: string }> {
    try {
      if (!ethers.isAddress(address)) {
        throw new Error('Invalid Ethereum address');
      }

      const provider = this.getProvider(chainId);
      const balance = await provider.getBalance(address);
      const balanceInEth = ethers.formatEther(balance);

      await this.prisma.wallet.upsert({
        where: { address: address.toLowerCase() },
        update: { updatedAt: new Date() },
        create: { address: address.toLowerCase() },
      });

      return { balance: balanceInEth };
    } catch (error) {
      throw new Error(`Failed to fetch balance: ${error.message}`);
    }
  }

  async getTransactions(
    address: string,
    type?: 'sent' | 'received',
    limit: number = 20,
    page: number = 1,
    chainId: number = 11155111,
  ): Promise<{
    transactions: TransactionResponse[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  }> {
    try {
      if (!ethers.isAddress(address)) {
        throw new Error('Invalid Ethereum address');
      }

      const normalizedAddress = address.toLowerCase();

      const wallet = await this.prisma.wallet.findUnique({
        where: { address: normalizedAddress },
        include: {
          transactions: {
            where: { chainId } as any,
            orderBy: { timestamp: 'desc' },
          },
        },
      });

      let allTransactions: TransactionResponse[] = [];

      if (wallet && wallet.transactions && wallet.transactions.length > 0) {
        allTransactions = wallet.transactions.map((tx) => ({
          hash: tx.hash,
          from: tx.fromAddress,
          to: tx.toAddress,
          value: tx.amount,
          blockNumber: Number(tx.blockNumber),
          gasUsed: tx.gasUsed ? tx.gasUsed.toString() : undefined,
          gasPrice: tx.gasPrice ? tx.gasPrice.toString() : undefined,
          timestamp: Math.floor(tx.timestamp.getTime() / 1000),
          status: tx.status as 'success' | 'failed',
        }));
      } else {
        allTransactions = [];
        this.syncTransactionsInBackground(normalizedAddress, chainId).catch(
          () => {},
        );
      }

      if (type === 'sent') {
        allTransactions = allTransactions.filter(
          (tx) => tx.from.toLowerCase() === normalizedAddress,
        );
      } else if (type === 'received') {
        allTransactions = allTransactions.filter(
          (tx) => tx.to.toLowerCase() === normalizedAddress,
        );
      }

      const total = allTransactions.length;
      const totalPages = Math.ceil(total / limit);
      const hasMore = page < totalPages;
      const skip = (page - 1) * limit;
      const transactions = allTransactions.slice(skip, skip + limit);

      return {
        transactions,
        total,
        page,
        limit,
        totalPages,
        hasMore,
      };
    } catch (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }
  }

  private isValidTransaction(tx: unknown): tx is ethers.TransactionResponse {
    return tx !== null && typeof tx === 'object' && 'from' in tx && 'to' in tx;
  }

  private async syncTransactionsInBackground(
    address: string,
    chainId: number,
  ): Promise<void> {
    try {
      let transactions = await this.fetchTransactionsFromEtherscan(
        address,
        50,
        chainId,
      );
      if (transactions.length === 0) {
        transactions = await this.fetchTransactionsFromBlockchain(
          address,
          50,
          chainId,
        );
      }

      let wallet = await this.prisma.wallet.findUnique({
        where: { address },
      });

      if (!wallet) {
        wallet = await this.prisma.wallet.create({
          data: { address },
        });
      }

      for (const tx of transactions) {
        try {
          await this.prisma.transaction.upsert({
            where: { hash_chainId: { hash: tx.hash, chainId } } as any,
            update: {
              fromAddress: tx.from.toLowerCase(),
              toAddress: tx.to.toLowerCase(),
              amount: tx.value,
              blockNumber: BigInt(tx.blockNumber),
              gasUsed: tx.gasUsed ? BigInt(tx.gasUsed) : null,
              gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : null,
              timestamp: new Date(tx.timestamp * 1000),
              status: tx.status,
              chainId,
              walletId: wallet.id,
            } as any,
            create: {
              hash: tx.hash,
              fromAddress: tx.from.toLowerCase(),
              toAddress: tx.to.toLowerCase(),
              amount: tx.value,
              blockNumber: BigInt(tx.blockNumber),
              gasUsed: tx.gasUsed ? BigInt(tx.gasUsed) : null,
              gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : null,
              timestamp: new Date(tx.timestamp * 1000),
              status: tx.status,
              chainId,
              walletId: wallet.id,
            } as any,
          });
        } catch {
          // Skip failed transaction cache
        }
      }
    } catch {
      // Silently fail background sync
    }
  }

  private async fetchTransactionsFromEtherscan(
    address: string,
    limit: number,
    chainId: number,
  ): Promise<TransactionResponse[]> {
    if (!this.etherscanApiKey) {
      return [];
    }

    try {
      const etherscanChainId = this.networkConfig.getEtherscanChainId(chainId);
      const url = `${ETHERSCAN_CONFIG.apiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc&chainid=${etherscanChainId}&apikey=${this.etherscanApiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === '0' || data.status === 0) {
        if (
          data.message &&
          (data.message.includes('No transactions found') ||
            data.message === 'No transactions found')
        ) {
          return [];
        }
        return [];
      }

      const result = data.result || [];
      if (
        typeof result === 'string' ||
        !Array.isArray(result) ||
        result.length === 0
      ) {
        return [];
      }

      const transactions: TransactionResponse[] = [];
      for (const tx of result.slice(0, limit)) {
        transactions.push({
          hash: tx.hash,
          from: tx.from,
          to: tx.to || '',
          value: ethers.formatEther(tx.value || '0'),
          blockNumber: parseInt(tx.blockNumber),
          gasUsed: tx.gasUsed,
          gasPrice: tx.gasPrice,
          timestamp: parseInt(tx.timeStamp),
          status: tx.isError === '0' ? 'success' : 'failed',
        });
      }

      return transactions;
    } catch (error) {
      return [];
    }
  }

  private async fetchTransactionsFromBlockchain(
    address: string,
    limit: number,
    chainId: number,
  ): Promise<TransactionResponse[]> {
    const transactions: TransactionResponse[] = [];
    const maxBlocksToCheck = 5000;
    const timeout = 30000;

    try {
      const provider = this.getProvider(chainId);
      const currentBlock = await Promise.race([
        provider.getBlockNumber(),
        new Promise<number>((_, reject) =>
          setTimeout(
            () => reject(new Error('Timeout getting block number')),
            timeout,
          ),
        ),
      ]);

      const blockStep = Math.max(1, Math.floor(maxBlocksToCheck / 1000));

      for (
        let i = 0;
        i < maxBlocksToCheck && transactions.length < limit;
        i += blockStep
      ) {
        try {
          const blockNumber = currentBlock - i;
          if (blockNumber < 0) break;

          const block = await Promise.race([
            provider.getBlock(blockNumber, true),
            new Promise<ethers.Block | null>((_, reject) =>
              setTimeout(() => reject(new Error('Block fetch timeout')), 3000),
            ),
          ]);

          if (block && block.transactions) {
            for (const tx of block.transactions) {
              if (transactions.length >= limit) break;

              if (this.isValidTransaction(tx) && tx.from && tx.to) {
                const from = tx.from.toLowerCase();
                const to = tx.to.toLowerCase();

                if (from === address || to === address) {
                  try {
                    const receipt = await Promise.race([
                      provider.getTransactionReceipt(tx.hash),
                      new Promise<ethers.TransactionReceipt | null>(
                        (_, reject) =>
                          setTimeout(
                            () => reject(new Error('Receipt timeout')),
                            2000,
                          ),
                      ),
                    ]);

                    transactions.push({
                      hash: tx.hash,
                      from: tx.from,
                      to: tx.to || '',
                      value: ethers.formatEther(tx.value || 0),
                      blockNumber: blockNumber,
                      gasUsed: receipt?.gasUsed.toString(),
                      gasPrice: tx.gasPrice?.toString(),
                      timestamp: block?.timestamp || 0,
                      status: receipt?.status === 1 ? 'success' : 'failed',
                    });
                  } catch {
                    continue;
                  }
                }
              }
            }
          }
        } catch {
          continue;
        }
      }
    } catch {
      return [];
    }

    return transactions.sort((a, b) => b.timestamp - a.timestamp);
  }
}
