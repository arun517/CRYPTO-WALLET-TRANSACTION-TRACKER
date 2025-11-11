/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@crypto-wallet-tracker/types', '@crypto-wallet-tracker/config'],
};

module.exports = nextConfig;

