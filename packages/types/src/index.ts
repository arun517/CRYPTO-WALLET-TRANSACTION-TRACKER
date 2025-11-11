export interface Wallet {
  id: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  hash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  blockNumber: bigint;
  gasUsed?: bigint;
  gasPrice?: bigint;
  timestamp: Date;
  status: 'success' | 'failed';
  walletId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletBalance {
  address: string;
  balance: string; // ETH balance as string
}

export interface TransactionResponse {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: number;
  gasUsed?: string;
  gasPrice?: string;
  timestamp: number;
  status: 'success' | 'failed';
}

export interface TransactionListResponse {
  transactions: TransactionResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export type TransactionType = 'sent' | 'received' | 'all';

export interface TokenBalance {
  contractAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
}

export interface NetworkInfo {
  chainId: number;
  name: string;
  isSupported: boolean;
}

export interface SavedAddress {
  id: string;
  address: string;
  label: string;
  createdAt: Date;
}

