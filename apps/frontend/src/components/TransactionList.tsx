'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TransactionResponse, TransactionType } from '@crypto-wallet-tracker/types';
import { API_CONFIG } from '@crypto-wallet-tracker/config';

interface TransactionListProps {
  walletAddress: string;
  chainId?: number;
}

export function TransactionList({ walletAddress, chainId = 11155111 }: TransactionListProps) {
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TransactionType>('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchTransactions = useCallback(async (currentPage: number, reset: boolean = false) => {
    if (reset) {
    setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    try {
      const url = new URL(`${API_CONFIG.baseUrl}/wallet/${walletAddress}/transactions`);
      if (filter !== 'all') {
        url.searchParams.append('type', filter);
      }
      url.searchParams.append('page', currentPage.toString());
      url.searchParams.append('limit', limit.toString());
      url.searchParams.append('chainId', chainId.toString());
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      if (reset) {
      setTransactions(data.transactions || []);
      } else {
        setTransactions((prev) => [...prev, ...(data.transactions || [])]);
      }
      setTotal(data.total || 0);
      setHasMore(data.hasMore || false);
      setPage(currentPage);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load transactions';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [walletAddress, filter, limit, chainId]);

  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      fetchTransactions(page + 1, false);
    }
  }, [page, hasMore, loading, loadingMore, fetchTransactions]);

  useEffect(() => {
    setTransactions([]);
    setPage(1);
    setHasMore(false);
    fetchTransactions(1, true);
  }, [fetchTransactions]);

  // Infinite scroll observer - watch for scroll within the container
  useEffect(() => {
    const container = scrollContainerRef.current;
    const target = observerTarget.current;
    
    if (!container || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMore();
        }
      },
      { 
        threshold: 0.1,
        root: container, // Use the scrollable container as root
        rootMargin: '0px'
      }
    );

    observer.observe(target);

    return () => {
      observer.unobserve(target);
    };
  }, [hasMore, loading, loadingMore, loadMore]);

  const syncTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/transactions/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: walletAddress, chainId }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to sync transactions');
      }

      await response.json();
      setTransactions([]);
      setPage(1);
      await fetchTransactions(1, true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync transactions';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = useCallback((addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }, []);

  const formatValue = useCallback((value: string) => {
    const num = parseFloat(value);
    return num.toFixed(6);
  }, []);

  const formatDate = useCallback((timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  }, []);

  const handleTransactionClick = (hash: string) => {
    router.push(`/transaction/${hash}`);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Recent Transactions
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-2">
          {(['all', 'sent', 'received'] as TransactionType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-lg transition-colors duration-200 capitalize ${
                filter === type
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {type}
            </button>
          ))}
          </div>
          <button
            onClick={syncTransactions}
            disabled={loading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
            title="Sync transactions from blockchain"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-12">
          <svg className="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {!loading && !error && transactions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No transactions found</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
            Click &quot;Sync&quot; to fetch transactions from the blockchain.
          </p>
          <button
            onClick={syncTransactions}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200"
          >
            Sync Transactions
          </button>
        </div>
      )}

      {!loading && !error && transactions.length > 0 && (
        <>
          <div ref={scrollContainerRef} className="max-h-[600px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="space-y-4 p-4">
              {transactions.map((tx) => {
                const isSent = tx.from.toLowerCase() === walletAddress.toLowerCase();
                return (
            <div
              key={tx.hash}
              onClick={() => handleTransactionClick(tx.hash)}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            isSent
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                    }`}>
                            {isSent ? 'Sent' : 'Received'}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      tx.status === 'success'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">From: </span>
                      <span className="font-mono text-gray-900 dark:text-white">
                        {formatAddress(tx.from)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">To: </span>
                      <span className="font-mono text-gray-900 dark:text-white">
                        {formatAddress(tx.to)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Amount: </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatValue(tx.value)} ETH
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Time: </span>
                      <span className="text-gray-900 dark:text-white">
                        {formatDate(tx.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="ml-4">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
                );
              })}

              {/* Infinite Scroll Loader - placed at the bottom of scrollable area */}
              {hasMore && (
                <div ref={observerTarget} className="flex justify-center items-center py-8">
                  {loadingMore && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Loading more transactions...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Transaction Count */}
          <div className="text-center text-sm text-gray-600 dark:text-gray-400 pt-4 mt-4">
            Showing {transactions.length} of {total} transactions
            {hasMore && ' • Scroll down for more'}
        </div>
        </>
      )}
    </div>
  );
}

