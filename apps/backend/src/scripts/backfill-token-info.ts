import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { NetworkConfigService } from '../config/network.config';

const prisma = new PrismaClient();

// ERC-20 Transfer event signature
const TRANSFER_EVENT_SIGNATURE =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

async function getProvider(chainId: number, rpcUrl: string): Promise<ethers.JsonRpcProvider> {
  return new ethers.JsonRpcProvider(rpcUrl);
}

async function detectTokenTransfer(
  receipt: ethers.TransactionReceipt | null,
): Promise<{
  contractAddress: string;
  from: string;
  to: string;
  amount: bigint;
} | null> {
  if (!receipt || !receipt.logs || receipt.logs.length === 0) {
    return null;
  }

  for (const log of receipt.logs) {
    try {
      if (
        log.topics &&
        log.topics.length === 3 &&
        log.topics[0] === TRANSFER_EVENT_SIGNATURE
      ) {
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

async function getTokenMetadata(
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

async function getRpcUrl(chainId: number): Promise<string> {
  // Default RPC URLs - can be overridden with environment variables
  if (chainId === 1) {
    return process.env.MAINNET_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo';
  } else if (chainId === 11155111) {
    return (
      process.env.SEPOLIA_RPC_URL ||
      process.env.ETHEREUM_RPC_URL ||
      'https://eth-sepolia.g.alchemy.com/v2/demo'
    );
  }
  throw new Error(`Unsupported chainId: ${chainId}`);
}

async function backfillTransaction(tx: any): Promise<void> {
  try {
    // Skip if already has token info
    if (tx.tokenContractAddress) {
      console.log(`Skipping ${tx.hash} - already has token info`);
      return;
    }

    const chainId = tx.chainId;
    const rpcUrl = await getRpcUrl(chainId);
    const provider = await getProvider(chainId, rpcUrl);

    console.log(`Processing ${tx.hash} on chain ${chainId}...`);

    const receipt = await provider
      .getTransactionReceipt(tx.hash)
      .catch(() => null);

    if (!receipt) {
      console.log(`  No receipt found for ${tx.hash}`);
      return;
    }

    const tokenTransferInfo = await detectTokenTransfer(receipt);
    if (!tokenTransferInfo) {
      console.log(`  No token transfer detected for ${tx.hash}`);
      return;
    }

    console.log(`  Token transfer detected: ${tokenTransferInfo.contractAddress}`);

    const tokenMetadata = await getTokenMetadata(
      tokenTransferInfo.contractAddress,
      provider,
    );
    const decimals = tokenMetadata.decimals ?? 18;
    const amountFormatted = ethers.formatUnits(
      tokenTransferInfo.amount,
      decimals,
    );

    const existingTx = await prisma.transaction.findFirst({
      where: { hash: tx.hash, chainId: tx.chainId } as any,
    });

    if (existingTx) {
      await prisma.transaction.update({
        where: { id: existingTx.id },
        data: {
          tokenContractAddress: tokenTransferInfo.contractAddress,
          tokenName: tokenMetadata.name || null,
          tokenSymbol: tokenMetadata.symbol || null,
          tokenDecimals: decimals ? Number(decimals) : null,
          tokenAmount: tokenTransferInfo.amount.toString(),
          tokenAmountFormatted: amountFormatted,
        },
      });
    }

    console.log(
      `  ✓ Updated: ${amountFormatted} ${tokenMetadata.symbol || 'TOKEN'}`,
    );
  } catch (error) {
    console.error(`  ✗ Error processing ${tx.hash}:`, error.message);
  }
}

async function main() {
  console.log('Starting token info backfill...\n');

  // Get all transactions without token info
  const transactions = await prisma.transaction.findMany({
    where: {
      tokenContractAddress: null,
    },
    orderBy: {
      timestamp: 'desc',
    },
  });

  console.log(`Found ${transactions.length} transactions to process\n`);

  let processed = 0;
  let updated = 0;

  for (const tx of transactions) {
    processed++;
    const beforeUpdate = !tx.tokenContractAddress;
    await backfillTransaction(tx);
    const afterTx = await prisma.transaction.findUnique({
      where: { id: tx.id },
    });
    if (beforeUpdate && afterTx?.tokenContractAddress) {
      updated++;
    }

    // Add a small delay to avoid rate limiting
    if (processed % 10 === 0) {
      console.log(`\nProgress: ${processed}/${transactions.length} processed, ${updated} updated\n`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n✓ Backfill complete!`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Updated: ${updated}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

