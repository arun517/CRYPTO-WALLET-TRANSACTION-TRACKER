import { Module } from '@nestjs/common';
import {
  TransactionController,
  TransactionsController,
} from './transaction.controller';
import { TransactionService } from './transaction.service';
import { NetworkConfigService } from '../config/network.config';

@Module({
  controllers: [TransactionController, TransactionsController],
  providers: [TransactionService, NetworkConfigService],
  exports: [TransactionService],
})
export class TransactionModule {}
