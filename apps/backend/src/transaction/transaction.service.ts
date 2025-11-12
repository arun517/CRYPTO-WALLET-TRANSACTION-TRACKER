import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ethers } from 'ethers';
import { TransactionResponse } from '@crypto-wallet-tracker/types';
import { ETHERSCAN_CONFIG } from '@crypto-wallet-tracker/config';
import { NetworkConfigService } from '../config/network.config';

@Injectable()
export class TransactionService {
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
          // Topics are: [event signature, from (indexed), to (indexed)]
          // Data contains: value (uint256)
          const fromTopic = String(log.topics[1]);
          const toTopic = String(log.topics[2]);

          // Extract addresses from topics (they're padded to 32 bytes/64 hex chars)
          // Remove '0x' prefix if present, then take last 40 chars (20 bytes = address)
          const fromHex = fromTopic.startsWith('0x')
            ? fromTopic.slice(2)
            : fromTopic;
          const toHex = toTopic.startsWith('0x') ? toTopic.slice(2) : toTopic;

          const from = ethers.getAddress('0x' + fromHex.slice(-40));
          const to = ethers.getAddress('0x' + toHex.slice(-40));

          // Parse amount from data (remove '0x' prefix if present)
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
        // Skip this log if there's an error parsing it
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
      // ERC-20 standard function signatures
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

      const tokenTransferInfo = await this.detectTokenTransfer(receipt, provider);
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

  async getTransactionByHash(
    hash: string,
    chainId: number = 11155111,
  ): Promise<TransactionResponse> {
    try {
      const cachedTx = await this.prisma.transaction.findFirst({
        where: { hash, chainId } as any,
      });

      if (cachedTx) {
        const transactionResponse: TransactionResponse = {
          hash: cachedTx.hash,
          from: cachedTx.fromAddress,
          to: cachedTx.toAddress,
          value: cachedTx.amount,
          blockNumber: Number(cachedTx.blockNumber),
          gasUsed: cachedTx.gasUsed ? cachedTx.gasUsed.toString() : undefined,
          gasPrice: cachedTx.gasPrice
            ? cachedTx.gasPrice.toString()
            : undefined,
          timestamp: Math.floor(cachedTx.timestamp.getTime() / 1000),
          status: cachedTx.status as 'success' | 'failed',
        };

        // Include token transfer info from cache if available
        if ((cachedTx as any).tokenContractAddress) {
          transactionResponse.tokenTransfer = {
            contractAddress: (cachedTx as any).tokenContractAddress,
            tokenName: (cachedTx as any).tokenName || undefined,
            tokenSymbol: (cachedTx as any).tokenSymbol || undefined,
            tokenDecimals: (cachedTx as any).tokenDecimals || undefined,
            amount: (cachedTx as any).tokenAmount || '0',
            amountFormatted: (cachedTx as any).tokenAmountFormatted || '0',
          };
        } else {
          // If no token info in cache, try to enrich it in the background
          // This will populate the database for future requests
          this.enrichAndCacheTokenInfo(transactionResponse, chainId).catch(
            () => {},
          );
        }

        return transactionResponse;
      }

      const provider = this.getProvider(chainId);
      const tx = await provider.getTransaction(hash);
      if (!tx) {
        throw new NotFoundException(`Transaction ${hash} not found`);
      }

      const receipt = await provider.getTransactionReceipt(hash);
      const block = await provider.getBlock(tx.blockNumber || 0);

      const transactionResponse: TransactionResponse = {
        hash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        value: ethers.formatEther(tx.value || 0),
        blockNumber: tx.blockNumber || 0,
        gasUsed: receipt?.gasUsed.toString(),
        gasPrice: tx.gasPrice?.toString(),
        timestamp: block?.timestamp || 0,
        status: receipt?.status === 1 ? 'success' : 'failed',
      };

      // Detect token transfer
      try {
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

            transactionResponse.tokenTransfer = {
              contractAddress: tokenTransferInfo.contractAddress,
              tokenName: tokenMetadata.name,
              tokenSymbol: tokenMetadata.symbol,
              tokenDecimals: decimals,
              amount: tokenTransferInfo.amount.toString(),
              amountFormatted,
            };
          } catch (error) {
            // If token metadata fetch fails, still include basic token transfer info
            const decimals = 18; // Default to 18 if we can't fetch
            const amountFormatted = ethers.formatUnits(
              tokenTransferInfo.amount,
              decimals,
            );
            transactionResponse.tokenTransfer = {
              contractAddress: tokenTransferInfo.contractAddress,
              tokenName: undefined,
              tokenSymbol: undefined,
              tokenDecimals: decimals,
              amount: tokenTransferInfo.amount.toString(),
              amountFormatted,
            };
          }
        }
      } catch (error) {
        // Silently fail token detection - don't break the transaction response
      }

      await this.cacheTransaction(transactionResponse, chainId);

      return transactionResponse;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Failed to fetch transaction: ${error.message}`);
    }
  }

  async syncTransactions(
    address: string,
    chainId: number = 11155111,
  ): Promise<{ synced: number }> {
    try {
      if (!ethers.isAddress(address)) {
        throw new Error('Invalid Ethereum address');
      }

      const normalizedAddress = address.toLowerCase();

      let wallet = await this.prisma.wallet.findUnique({
        where: { address: normalizedAddress },
      });

      if (!wallet) {
        wallet = await this.prisma.wallet.create({
          data: { address: normalizedAddress },
        });
      }

      let transactions = await this.fetchTransactionsFromEtherscan(
        normalizedAddress,
        50,
        chainId,
      );
      if (transactions.length === 0) {
        transactions = await this.fetchTransactionsFromBlockchain(
          normalizedAddress,
          50,
          chainId,
        );
      }

      let synced = 0;
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
          synced++;
        } catch {
          // Skip failed transaction sync
        }
      }

      return { synced };
    } catch (error) {
      throw new Error(`Failed to sync transactions: ${error.message}`);
    }
  }

  private isValidTransaction(tx: unknown): tx is ethers.TransactionResponse {
    return tx !== null && typeof tx === 'object' && 'from' in tx && 'to' in tx;
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

          if (block?.transactions) {
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
                            3000,
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

  private async enrichAndCacheTokenInfo(
    tx: TransactionResponse,
    chainId: number,
  ): Promise<void> {
    try {
      const enrichedTx = await this.enrichTransactionWithTokenInfo(tx, chainId);
      if (enrichedTx.tokenTransfer) {
        await this.cacheTransaction(enrichedTx, chainId);
      }
    } catch {
      // Silently fail - enrichment is not critical
    }
  }

  private async cacheTransaction(
    tx: TransactionResponse,
    chainId: number,
  ): Promise<void> {
    try {
      let wallet = await this.prisma.wallet.findFirst({
        where: {
          OR: [
            { address: tx.from.toLowerCase() },
            { address: tx.to.toLowerCase() },
          ],
        },
      });

      if (!wallet) {
        wallet = await this.prisma.wallet.create({
          data: { address: tx.from.toLowerCase() },
        });
      }

      const updateData: any = {
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
      };

      const createData: any = {
        hash: tx.hash,
        ...updateData,
      };

      // Include token transfer info if available
      if (tx.tokenTransfer) {
        updateData.tokenContractAddress = tx.tokenTransfer.contractAddress;
        updateData.tokenName = tx.tokenTransfer.tokenName || null;
        updateData.tokenSymbol = tx.tokenTransfer.tokenSymbol || null;
        updateData.tokenDecimals = tx.tokenTransfer.tokenDecimals || null;
        updateData.tokenAmount = tx.tokenTransfer.amount;
        updateData.tokenAmountFormatted = tx.tokenTransfer.amountFormatted;

        createData.tokenContractAddress = tx.tokenTransfer.contractAddress;
        createData.tokenName = tx.tokenTransfer.tokenName || null;
        createData.tokenSymbol = tx.tokenTransfer.tokenSymbol || null;
        createData.tokenDecimals = tx.tokenTransfer.tokenDecimals || null;
        createData.tokenAmount = tx.tokenTransfer.amount;
        createData.tokenAmountFormatted = tx.tokenTransfer.amountFormatted;
      }

      await this.prisma.transaction.upsert({
        where: { hash_chainId: { hash: tx.hash, chainId } } as any,
        update: updateData,
        create: createData,
      });
    } catch {
      // Don't throw - caching is not critical
    }
  }
}
