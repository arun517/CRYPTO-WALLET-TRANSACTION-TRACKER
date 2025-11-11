export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  timeout: 30000,
};

export const CHAIN_CONFIG = {
  chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '11155111'),
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || '',
};

export const ETHERSCAN_CONFIG = {
  apiUrl: process.env.ETHERSCAN_API_URL || 'https://api.etherscan.io/v2/api',
  chainId: process.env.ETHERSCAN_CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || '11155111',
};

