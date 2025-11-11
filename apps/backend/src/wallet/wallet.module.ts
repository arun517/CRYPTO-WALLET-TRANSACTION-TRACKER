import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { NetworkConfigService } from '../config/network.config';

@Module({
  controllers: [WalletController],
  providers: [WalletService, NetworkConfigService],
  exports: [WalletService],
})
export class WalletModule {}
