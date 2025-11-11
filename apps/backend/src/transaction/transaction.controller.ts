import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { IsEthereumAddress, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

class SyncTransactionsDto {
  @ApiProperty({
    description: 'Ethereum wallet address',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @IsEthereumAddress()
  address: string;

  @ApiProperty({
    description: 'Network chain ID (1 for Mainnet, 11155111 for Sepolia)',
    example: 11155111,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  chainId?: number;
}

@ApiTags('transaction')
@Controller('transaction')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get(':hash')
  @ApiOperation({
    summary: 'Get transaction by hash',
    description: 'Returns detailed information about a specific transaction',
  })
  @ApiParam({
    name: 'hash',
    description: 'Transaction hash',
    example:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction retrieved successfully',
  })
  @ApiQuery({
    name: 'chainId',
    required: false,
    type: Number,
    description: 'Network chain ID (1 for Mainnet, 11155111 for Sepolia)',
    example: 11155111,
  })
  @ApiResponse({ status: 400, description: 'Invalid transaction hash' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransaction(
    @Param('hash') hash: string,
    @Query('chainId') chainId?: number,
  ) {
    if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      throw new BadRequestException('Invalid transaction hash');
    }
    return this.transactionService.getTransactionByHash(
      hash,
      chainId || 11155111,
    );
  }
}

@ApiTags('transaction')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post('sync')
  @ApiOperation({
    summary: 'Sync transactions',
    description:
      'Fetches and caches transactions for a wallet address from the blockchain',
  })
  @ApiBody({ type: SyncTransactionsDto, description: 'Wallet address to sync' })
  @ApiResponse({
    status: 200,
    description: 'Transaction sync initiated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid Ethereum address' })
  async syncTransactions(@Body() dto: SyncTransactionsDto) {
    return this.transactionService.syncTransactions(
      dto.address,
      dto.chainId || 11155111,
    );
  }
}
