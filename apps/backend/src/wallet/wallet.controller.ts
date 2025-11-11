import {
  Controller,
  Get,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class GetTransactionsQuery {
  @ApiProperty({
    description: 'Filter by transaction type',
    enum: ['sent', 'received'],
    required: false,
    example: 'sent',
  })
  @IsOptional()
  @IsIn(['sent', 'received'])
  type?: 'sent' | 'received';

  @ApiProperty({
    description: 'Number of transactions per page (1-100)',
    example: 20,
    required: false,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({
    description: 'Page number',
    example: 1,
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

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

@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get(':address/balance')
  @ApiOperation({
    summary: 'Get wallet balance',
    description: 'Returns the ETH balance for a given wallet address',
  })
  @ApiParam({
    name: 'address',
    description: 'Ethereum wallet address',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @ApiQuery({
    name: 'chainId',
    required: false,
    type: Number,
    description: 'Network chain ID (1 for Mainnet, 11155111 for Sepolia)',
    example: 11155111,
  })
  @ApiResponse({
    status: 200,
    description: 'Balance retrieved successfully',
    schema: { example: { balance: '1.234567' } },
  })
  @ApiResponse({ status: 400, description: 'Invalid Ethereum address' })
  async getBalance(
    @Param('address') address: string,
    @Query('chainId') chainId?: number,
  ) {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new BadRequestException('Invalid Ethereum address');
    }
    return this.walletService.getBalance(address, chainId || 11155111);
  }

  @Get(':address/transactions')
  @ApiOperation({
    summary: 'Get wallet transactions',
    description: 'Returns paginated list of transactions for a wallet address',
  })
  @ApiParam({
    name: 'address',
    description: 'Ethereum wallet address',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['sent', 'received'],
    description: 'Filter by transaction type',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of transactions per page (1-100)',
    example: 20,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'chainId',
    required: false,
    type: Number,
    description: 'Network chain ID (1 for Mainnet, 11155111 for Sepolia)',
    example: 11155111,
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid Ethereum address or query parameters',
  })
  async getTransactions(
    @Param('address') address: string,
    @Query() query: GetTransactionsQuery,
  ) {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new BadRequestException('Invalid Ethereum address');
    }
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const page = query.page && query.page > 0 ? query.page : 1;
    const chainId = query.chainId || 11155111;
    return this.walletService.getTransactions(
      address,
      query.type,
      limit,
      page,
      chainId,
    );
  }
}
