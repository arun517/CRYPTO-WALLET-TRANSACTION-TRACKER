'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { TransactionResponse } from '@crypto-wallet-tracker/types';
import { API_CONFIG } from '@crypto-wallet-tracker/config';
import { Toast } from '@/components/Toast';

export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [transaction, setTransaction] = useState<TransactionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const hash = params.hash as string;

  useEffect(() => {
    if (hash) {
      fetchTransaction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  const fetchTransaction = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get chainId from URL search params or default to Sepolia
      const searchParams = new URLSearchParams(window.location.search);
      const chainId = searchParams.get('chainId') || '11155111';
      
      const url = new URL(`${API_CONFIG.baseUrl}/transaction/${hash}`);
      url.searchParams.append('chainId', chainId);
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Transaction not found');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch transaction');
      }

      const data = await response.json();
      setTransaction(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load transaction';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
  };

  const formatValue = (value: string) => {
    const num = parseFloat(value);
    return num.toFixed(6);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatGas = (gas: string | undefined) => {
    if (!gas) return 'N/A';
    return BigInt(gas).toString();
  };

  const formatGasPrice = (gasPrice: string | undefined) => {
    if (!gasPrice) return 'N/A';
    const gwei = BigInt(gasPrice) / BigInt(1e9);
    return `${gwei.toString()} Gwei`;
  };

  const handleCopy = async (text: string, message: string) => {
    await navigator.clipboard.writeText(text);
    setToastMessage(message);
    setToastVisible(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Transactions
        </button>

        {loading && (
          <div className="flex justify-center items-center py-12">
            <svg className="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}

        {error && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && transaction && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              Transaction Details
            </h1>

            <div className="space-y-6">
              {/* Status Badge */}
              <div className="flex items-center gap-4">
                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  transaction.status === 'success'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                }`}>
                  {transaction.status === 'success' ? 'Success' : 'Failed'}
                </span>
              </div>

              {/* Transaction Hash */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <label className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 block">
                      Transaction Hash
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-sm text-gray-900 dark:text-white break-all">
                        {transaction.hash}
                      </span>
                      <button
                        onClick={() => handleCopy(transaction.hash, 'Transaction hash copied!')}
                        className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
                        title="Copy hash"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* From Address */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 block">
                  From
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-sm text-gray-900 dark:text-white">
                    {formatAddress(transaction.from)}
                  </span>
                  <button
                    onClick={() => handleCopy(transaction.from, 'Address copied!')}
                    className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
                    title="Copy address"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* To Address */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 block">
                  To
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-sm text-gray-900 dark:text-white">
                    {formatAddress(transaction.to)}
                  </span>
                  <button
                    onClick={() => handleCopy(transaction.to, 'Address copied!')}
                    className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
                    title="Copy address"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Value / Token Transfer */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 block">
                  {transaction.tokenTransfer ? 'Token Transfer' : 'Value'}
                </label>
                {transaction.tokenTransfer ? (
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {parseFloat(transaction.tokenTransfer.amountFormatted).toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })}{' '}
                      {transaction.tokenTransfer.tokenSymbol || 'TOKEN'}
                    </p>
                    {transaction.tokenTransfer.tokenName && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {transaction.tokenTransfer.tokenName}
                      </p>
                    )}
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        Contract: {formatAddress(transaction.tokenTransfer.contractAddress)}
                      </p>
                      {transaction.value !== '0.0' && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          Native ETH: {formatValue(transaction.value)} ETH
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {formatValue(transaction.value)} ETH
                  </p>
                )}
              </div>

              {/* Block Number */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 block">
                  Block Number
                </label>
                <p className="text-gray-900 dark:text-white font-mono">
                  {transaction.blockNumber.toLocaleString()}
                </p>
              </div>

              {/* Timestamp */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 block">
                  Timestamp
                </label>
                <p className="text-gray-900 dark:text-white">
                  {formatDate(transaction.timestamp)}
                </p>
              </div>

              {/* Gas Used */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 block">
                  Gas Used
                </label>
                <p className="text-gray-900 dark:text-white font-mono">
                  {formatGas(transaction.gasUsed)}
                </p>
              </div>

              {/* Gas Price */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 block">
                  Gas Price
                </label>
                <p className="text-gray-900 dark:text-white font-mono">
                  {formatGasPrice(transaction.gasPrice)}
                </p>
              </div>
            </div>
          </div>
        )}
        <Toast
          message={toastMessage}
          isVisible={toastVisible}
          onClose={() => setToastVisible(false)}
        />
      </div>
    </div>
  );
}

