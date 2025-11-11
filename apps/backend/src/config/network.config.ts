import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface NetworkConfig {
  rpcUrl: string;
  etherscanChainId: string;
  name: string;
}

@Injectable()
export class NetworkConfigService {
  private networks: Map<number, NetworkConfig> = new Map();

  constructor(private configService: ConfigService) {
    // Sepolia Testnet
    this.networks.set(11155111, {
      rpcUrl:
        this.configService.get<string>('SEPOLIA_RPC_URL') ||
        this.configService.get<string>('ETHEREUM_RPC_URL') ||
        'https://eth-sepolia.g.alchemy.com/v2/demo',
      etherscanChainId: '11155111',
      name: 'Sepolia',
    });

    // Ethereum Mainnet
    this.networks.set(1, {
      rpcUrl:
        this.configService.get<string>('MAINNET_RPC_URL') ||
        'https://eth-mainnet.g.alchemy.com/v2/demo',
      etherscanChainId: '1',
      name: 'Mainnet',
    });
  }

  getNetworkConfig(chainId: number): NetworkConfig {
    const config = this.networks.get(chainId);
    if (!config) {
      // Default to Sepolia if chainId not found
      return this.networks.get(11155111)!;
    }
    return config;
  }

  getRpcUrl(chainId: number): string {
    return this.getNetworkConfig(chainId).rpcUrl;
  }

  getEtherscanChainId(chainId: number): string {
    return this.getNetworkConfig(chainId).etherscanChainId;
  }

  getNetworkName(chainId: number): string {
    return this.getNetworkConfig(chainId).name;
  }

  isSupportedNetwork(chainId: number): boolean {
    return this.networks.has(chainId);
  }
}
