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

  // ERC-20 Transfer event signature: Transfer(address indexed from, address indexed to, uint256 value)
  private readonly TRANSFER_EVENT_SIGNATURE =
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

  private async detectTokenTransfer(
    receipt: ethers.TransactionReceipt | null,
    provider: ethers.JsonRpcProvider,
  ): Promise<{
    contractAddress: string;
    from: string;
    to: string;
    amount: bigint;
  } | null> {
    if (!receipt || !receipt.logs || receipt.logs.length === 0) {
      return null;
    }

    // Find Transfer event logs
    for (const log of receipt.logs) {
      try {
        if (
          log.topics &&
          log.topics.length === 3 &&
          log.topics[0] === this.TRANSFER_EVENT_SIGNATURE
        ) {
          // This is an ERC-20 Transfer event
          const fromTopic = String(log.topics[1]);
          const toTopic = String(log.topics[2]);

          const fromHex = fromTopic.startsWith('0x')
            ? fromTopic.slice(2)
            : fromTopic;
          const toHex = toTopic.startsWith('0x') ? toTopic.slice(2) : toTopic;

          const from = ethers.getAddress('0x' + fromHex.slice(-40));
          const to = ethers.getAddress('0x' + toHex.slice(-40));

          const dataHex = String(log.data || '0x0');
          const amount = BigInt(dataHex);

          return {
            contractAddress: log.address,
            from,
            to,
            amount,
          };
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  private async getTokenMetadata(
    contractAddress: string,
    provider: ethers.JsonRpcProvider,
  ): Promise<{ name?: string; symbol?: string; decimals?: number }> {
    try {
      const nameAbi = ['function name() view returns (string)'];
      const symbolAbi = ['function symbol() view returns (string)'];
      const decimalsAbi = ['function decimals() view returns (uint8)'];

      const contract = new ethers.Contract(
        contractAddress,
        [...nameAbi, ...symbolAbi, ...decimalsAbi],
        provider,
      );

      const [name, symbol, decimals] = await Promise.allSettled([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
      ]);

      return {
        name: name.status === 'fulfilled' ? name.value : undefined,
        symbol: symbol.status === 'fulfilled' ? symbol.value : undefined,
        decimals: decimals.status === 'fulfilled' ? decimals.value : undefined,
      };
    } catch {
      return {};
    }
  }

  private async enrichTransactionWithTokenInfo(
    tx: TransactionResponse,
    chainId: number,
  ): Promise<TransactionResponse> {
    try {
      const provider = this.getProvider(chainId);
      const receipt = await provider
        .getTransactionReceipt(tx.hash)
        .catch(() => null);

      if (!receipt) {
        return tx;
      }

      const tokenTransferInfo = await this.detectTokenTransfer(
        receipt,
        provider,
      );
      if (tokenTransferInfo) {
        try {
          const tokenMetadata = await this.getTokenMetadata(
            tokenTransferInfo.contractAddress,
            provider,
          );
          const decimals = tokenMetadata.decimals ?? 18;
          const amountFormatted = ethers.formatUnits(
            tokenTransferInfo.amount,
            decimals,
          );

          tx.tokenTransfer = {
            contractAddress: tokenTransferInfo.contractAddress,
            tokenName: tokenMetadata.name,
            tokenSymbol: tokenMetadata.symbol,
            tokenDecimals: decimals,
            amount: tokenTransferInfo.amount.toString(),
            amountFormatted,
          };
        } catch (error) {
          // If token metadata fetch fails, still include basic token transfer info
          const decimals = 18;
          const amountFormatted = ethers.formatUnits(
            tokenTransferInfo.amount,
            decimals,
          );
          tx.tokenTransfer = {
            contractAddress: tokenTransferInfo.contractAddress,
            tokenName: undefined,
            tokenSymbol: undefined,
            tokenDecimals: decimals,
            amount: tokenTransferInfo.amount.toString(),
            amountFormatted,
          };
        }
      }

      return tx;
    } catch (error) {
      // Return original transaction if token detection fails
      return tx;
    }
  }

  private async cacheTokenInfo(
    tx: TransactionResponse,
    chainId: number,
  ): Promise<void> {
    if (!tx.tokenTransfer) {
      return;
    }

    try {
      await this.prisma.transaction.updateMany({
        where: { hash: tx.hash, chainId } as any,
        data: {
          tokenContractAddress: tx.tokenTransfer.contractAddress,
          tokenName: tx.tokenTransfer.tokenName || null,
          tokenSymbol: tx.tokenTransfer.tokenSymbol || null,
          tokenDecimals: tx.tokenTransfer.tokenDecimals || null,
          tokenAmount: tx.tokenTransfer.amount,
          tokenAmountFormatted: tx.tokenTransfer.amountFormatted,
        } as any,
      });
    } catch {
      // Silently fail - caching is not critical
    }
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
        // Map transactions to TransactionResponse format
        allTransactions = wallet.transactions.map((tx) => {
          const transactionResponse: TransactionResponse = {
            hash: tx.hash,
            from: tx.fromAddress,
            to: tx.toAddress,
            value: tx.amount,
            blockNumber: Number(tx.blockNumber),
            gasUsed: tx.gasUsed ? tx.gasUsed.toString() : undefined,
            gasPrice: tx.gasPrice ? tx.gasPrice.toString() : undefined,
            timestamp: Math.floor(tx.timestamp.getTime() / 1000),
            status: tx.status as 'success' | 'failed',
          };

          // Include token transfer info from cache if available
          if ((tx as any).tokenContractAddress) {
            transactionResponse.tokenTransfer = {
              contractAddress: (tx as any).tokenContractAddress,
              tokenName: (tx as any).tokenName || undefined,
              tokenSymbol: (tx as any).tokenSymbol || undefined,
              tokenDecimals: (tx as any).tokenDecimals || undefined,
              amount: (tx as any).tokenAmount || '0',
              amountFormatted: (tx as any).tokenAmountFormatted || '0',
            };
          }
          // Note: If no token info, it will be enriched later in the flow

          return transactionResponse;
        });
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

      // Enrich only transactions that don't have token info cached
      const transactionsToEnrich = transactions.filter(
        (tx) => !tx.tokenTransfer,
      );
      const enrichedTransactions = await Promise.allSettled(
        transactionsToEnrich.map((tx) =>
          this.enrichTransactionWithTokenInfo(tx, chainId),
        ),
      );

      // Update transactions with enriched data and cache token info
      const enrichedMap = new Map<string, TransactionResponse>();
      enrichedTransactions.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          enrichedMap.set(transactionsToEnrich[index].hash, result.value);
          // Cache the enriched transaction
          this.cacheTokenInfo(result.value, chainId).catch(() => {});
        }
      });

      const finalTransactions = transactions.map((tx) =>
        enrichedMap.get(tx.hash) || tx,
      );

      return {
        transactions: finalTransactions,
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
          // Detect and enrich token info before caching
          const provider = this.getProvider(chainId);
          const receipt = await provider
            .getTransactionReceipt(tx.hash)
            .catch(() => null);

          let enrichedTx = tx;
          if (receipt) {
            try {
              enrichedTx = await this.enrichTransactionWithTokenInfo(tx, chainId);
            } catch {
              // Continue with original tx if enrichment fails
            }
          }

          const updateData: any = {
            fromAddress: enrichedTx.from.toLowerCase(),
            toAddress: enrichedTx.to.toLowerCase(),
            amount: enrichedTx.value,
            blockNumber: BigInt(enrichedTx.blockNumber),
            gasUsed: enrichedTx.gasUsed ? BigInt(enrichedTx.gasUsed) : null,
            gasPrice: enrichedTx.gasPrice ? BigInt(enrichedTx.gasPrice) : null,
            timestamp: new Date(enrichedTx.timestamp * 1000),
            status: enrichedTx.status,
            chainId,
            walletId: wallet.id,
          };

          const createData: any = {
            hash: enrichedTx.hash,
            ...updateData,
          };

          // Include token transfer info if available
          if (enrichedTx.tokenTransfer) {
            updateData.tokenContractAddress = enrichedTx.tokenTransfer.contractAddress;
            updateData.tokenName = enrichedTx.tokenTransfer.tokenName || null;
            updateData.tokenSymbol = enrichedTx.tokenTransfer.tokenSymbol || null;
            updateData.tokenDecimals = enrichedTx.tokenTransfer.tokenDecimals || null;
            updateData.tokenAmount = enrichedTx.tokenTransfer.amount;
            updateData.tokenAmountFormatted = enrichedTx.tokenTransfer.amountFormatted;

            createData.tokenContractAddress = enrichedTx.tokenTransfer.contractAddress;
            createData.tokenName = enrichedTx.tokenTransfer.tokenName || null;
            createData.tokenSymbol = enrichedTx.tokenTransfer.tokenSymbol || null;
            createData.tokenDecimals = enrichedTx.tokenTransfer.tokenDecimals || null;
            createData.tokenAmount = enrichedTx.tokenTransfer.amount;
            createData.tokenAmountFormatted = enrichedTx.tokenTransfer.amountFormatted;
          }

          await this.prisma.transaction.upsert({
            where: { hash_chainId: { hash: enrichedTx.hash, chainId } } as any,
            update: updateData,
            create: createData,
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
