'use client';

import { useState } from 'react';
import { Toast } from './Toast';

interface WalletInfoProps {
  address: string;
  accounts: string[];
  balance: string | null;
  network: { chainId: number; name: string } | null;
  onAccountChange: (address: string) => void;
  onNetworkSwitch: (chainId: number) => void;
  onDisconnect: () => void;
}

export function WalletInfo({ 
  address, 
  accounts, 
  balance, 
  network,
  onAccountChange,
  onNetworkSwitch,
  onDisconnect 
}: WalletInfoProps) {
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatBalance = (bal: string | null) => {
    if (!bal) return '0.00';
    const num = parseFloat(bal);
    return num.toFixed(4);
  };

  const isSupportedNetwork = network?.chainId === 11155111 || network?.chainId === 1;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Wallet Info
          </h2>
          <div className="space-y-3">
            {/* Account Selection */}
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Account:</span>
              {accounts.length > 1 ? (
                <div className="relative">
                  <button
                    onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                    className="flex items-center gap-2 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <span className="font-mono text-sm">{formatAddress(address)}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showAccountDropdown && (
                    <div className="absolute z-10 mt-1 w-64 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                      {accounts.map((acc) => (
                        <button
                          key={acc}
                          onClick={() => {
                            onAccountChange(acc);
                            setShowAccountDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 ${
                            acc === address ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                          }`}
                        >
                          <div className="font-mono text-sm text-gray-900 dark:text-white">
                            {formatAddress(acc)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <span className="font-mono text-sm text-gray-900 dark:text-white">
                  {formatAddress(address)}
                </span>
              )}
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(address);
                  setToastVisible(true);
                }}
                className="ml-2 text-primary-600 hover:text-primary-700"
                title="Copy address"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>

            {/* Network Selection */}
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Network:</span>
              <div className="relative">
                <button
                  onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setTimeout(() => setShowNetworkDropdown(false), 200);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-1 border rounded-lg ${
                    isSupportedNetwork
                      ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                      : 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20'
                  }`}
                >
                  <span className={`text-sm font-semibold ${
                    isSupportedNetwork
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-yellow-700 dark:text-yellow-300'
                  }`}>
                    {network?.name || 'Unknown'}
                  </span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showNetworkDropdown && (
                  <div className="absolute z-10 mt-1 w-56 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                    <button
                      onClick={async () => {
                        if (network?.chainId !== 11155111) {
                          await onNetworkSwitch(11155111);
                        }
                        setShowNetworkDropdown(false);
                      }}
                      disabled={network?.chainId === 11155111}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed ${
                        network?.chainId === 11155111 ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">Sepolia Testnet</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Chain ID: 11155111</div>
                        </div>
                        {network?.chainId === 11155111 ? (
                          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded">Active</span>
                        ) : (
                          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded">Recommended</span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={async () => {
                        if (network?.chainId !== 1) {
                          await onNetworkSwitch(1);
                        }
                        setShowNetworkDropdown(false);
                      }}
                      disabled={network?.chainId === 1}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed ${
                        network?.chainId === 1 ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">Ethereum Mainnet</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Chain ID: 1</div>
                        </div>
                        {network?.chainId === 1 && (
                          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded">Active</span>
                        )}
                      </div>
                    </button>
                  </div>
                )}
              </div>
              {!isSupportedNetwork && (
                <span className="text-xs text-yellow-600 dark:text-yellow-400">
                  Switch to Sepolia or Mainnet
                </span>
              )}
            </div>

            {/* Balance */}
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Balance:</span>
              <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                {formatBalance(balance)} ETH
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onDisconnect}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
        >
          Disconnect
        </button>
      </div>
      <Toast
        message="Address copied to clipboard!"
        isVisible={toastVisible}
        onClose={() => setToastVisible(false)}
      />
    </div>
  );
}

