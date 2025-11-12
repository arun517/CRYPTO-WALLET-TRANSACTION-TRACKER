'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { WalletConnection } from '@/components/WalletConnection';
import { WalletInfo } from '@/components/WalletInfo';
import { TransactionList } from '@/components/TransactionList';

export default function Home() {
  const [accounts, setAccounts] = useState<string[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [network, setNetwork] = useState<{ chainId: number; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkWalletConnection();
    
    const handleChainChangedWrapper = (chainId: string) => {
      handleChainChanged(chainId);
    };
    
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChangedWrapper);
    }
    
    return () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChangedWrapper);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkWalletConnection = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accountList = await provider.listAccounts();
        if (accountList.length > 0) {
          setAccounts(accountList.map(acc => acc.address));
          setSelectedAccount(accountList[0].address);
          await fetchBalanceAndNetwork(accountList[0].address);
        }
      } catch (err) {
        // Silently handle connection check errors
      }
    }
  };

  const fetchBalanceAndNetwork = async (address: string) => {
    try {
      // Fetch network first
      if (window.ethereum) {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
        const chainIdNum = parseInt(chainId, 16);
        const networkName = chainIdNum === 11155111 ? 'Sepolia' : chainIdNum === 1 ? 'Mainnet' : `Chain ${chainIdNum}`;
        setNetwork({ chainId: chainIdNum, name: networkName });
        
        // Fetch balance directly from the connected provider to match the network
        const provider = new ethers.BrowserProvider(window.ethereum);
        const balance = await provider.getBalance(address);
        const balanceInEth = ethers.formatEther(balance);
        setBalance(balanceInEth);
        
        // If not on Sepolia, show a notice (but don't force switch)
        if (chainIdNum !== 11155111 && chainIdNum !== 1) {
          // Only prompt for unsupported networks
          const shouldSwitch = window.confirm(
            `You're connected to ${networkName}. This app works best on Sepolia Testnet or Mainnet. Would you like to switch to Sepolia?`
          );
          if (shouldSwitch) {
            await switchNetwork(11155111);
            return; // Will be called again after network switch
          }
        }
      }
    } catch (err) {
      // Silently handle fetch errors
    }
  };


  const handleAccountsChanged = (newAccounts: string[]) => {
    if (newAccounts.length === 0) {
      setAccounts([]);
      setSelectedAccount(null);
      setBalance(null);
    } else {
      setAccounts(newAccounts);
      setSelectedAccount(newAccounts[0]);
      fetchBalanceAndNetwork(newAccounts[0]);
    }
  };

  const handleChainChanged = async (chainId?: string) => {
    if (window.ethereum && selectedAccount) {
      try {
        const currentChainId = chainId || await window.ethereum.request({ method: 'eth_chainId' });
        const chainIdNum = typeof currentChainId === 'string' 
          ? parseInt(currentChainId, 16) 
          : currentChainId;
        const networkName = chainIdNum === 11155111 ? 'Sepolia' : chainIdNum === 1 ? 'Mainnet' : `Chain ${chainIdNum}`;
        setNetwork({ chainId: chainIdNum as number, name: networkName });
        if (selectedAccount) {
          await fetchBalanceAndNetwork(selectedAccount);
        }
      } catch (err) {
        // Silently handle chain change errors
      }
    }
  };

  const switchAccount = async (address: string) => {
    setSelectedAccount(address);
    await fetchBalanceAndNetwork(address);
  };

  const switchNetwork = async (targetChainId: number) => {
    if (!window.ethereum) return;
    setLoading(true);
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
      // The chainChanged event will be triggered automatically
      // Wait a bit for the event to fire
      await new Promise(resolve => setTimeout(resolve, 500));
      // Manually refresh network info if event hasn't fired yet
      if (selectedAccount) {
        await fetchBalanceAndNetwork(selectedAccount);
      }
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          const rpcUrl = targetChainId === 11155111 
            ? (process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_KEY')
            : 'https://mainnet.infura.io/v3/YOUR_KEY';
          
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${targetChainId.toString(16)}`,
              chainName: targetChainId === 11155111 ? 'Sepolia Testnet' : 'Ethereum Mainnet',
              rpcUrls: [rpcUrl],
              blockExplorerUrls: targetChainId === 11155111 
                ? ['https://sepolia.etherscan.io']
                : ['https://etherscan.io'],
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18,
              },
            }],
          });
          // After adding, switch to it
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${targetChainId.toString(16)}` }],
          });
          await new Promise(resolve => setTimeout(resolve, 500));
          if (selectedAccount) {
            await fetchBalanceAndNetwork(selectedAccount);
          }
        } catch (addError) {
          alert('Failed to add network. Please add the network manually in MetaMask.');
        }
      } else if (switchError.code !== 4001) {
        // 4001 is user rejection, don't show error for that
        alert(`Failed to switch network: ${switchError.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      
      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      setAccounts(accounts);
      setSelectedAccount(accounts[0]);
      await fetchBalanceAndNetwork(accounts[0]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setAccounts([]);
    setSelectedAccount(null);
    setBalance(null);
    setNetwork(null);
    setError(null);
  };

  if (!selectedAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <WalletConnection
          onConnect={connectWallet}
          loading={loading}
          error={error}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <WalletInfo
          address={selectedAccount}
          accounts={accounts}
          balance={balance}
          network={network}
          onAccountChange={switchAccount}
          onNetworkSwitch={switchNetwork}
          onDisconnect={disconnectWallet}
        />
        <TransactionList walletAddress={selectedAccount} chainId={network?.chainId || 11155111} />
      </div>
    </div>
  );
}

