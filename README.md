# Crypto Wallet Transaction Tracker

A full-stack web application for tracking Ethereum wallet transactions. Built with Next.js, NestJS, and Prisma in a Turborepo monorepo.

## Features

- 🔗 **Wallet Connection**: Connect MetaMask wallet
- 💰 **Balance Display**: View wallet balance in ETH
- 📊 **Transaction History**: View recent transactions with filtering
- 🔍 **Transaction Details**: Detailed view of individual transactions
- 💾 **Database Caching**: Transactions cached in PostgreSQL for faster access
- 🔄 **Sync Endpoint**: Sync latest transactions from blockchain

## Tech Stack

### Frontend
- Next.js 14+ (App Router)
- TypeScript
- ethers.js v6
- Tailwind CSS
- Custom UI components

### Backend
- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- ethers.js v6
- class-validator

### Infrastructure
- Turborepo (monorepo)
- pnpm (package manager)

## Prerequisites

- Node.js 18+ 
- pnpm 8+
- PostgreSQL (or use SQLite for development)
- MetaMask browser extension (for testing)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Install all dependencies
pnpm install
```

### 2. Database Setup

#### Option A: PostgreSQL (Recommended)

1. Create a PostgreSQL database:
```bash
createdb wallet_tracker
```

2. Update the `DATABASE_URL` in `apps/backend/.env`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/wallet_tracker"
```

#### Option B: SQLite (For Development)

1. Update `apps/backend/prisma/schema.prisma`:
```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

2. Update `apps/backend/.env`:
```
DATABASE_URL="file:./dev.db"
```

### 3. Environment Variables

#### Frontend (`apps/frontend/.env.local`)

Create `apps/frontend/.env.local`:

```env
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

#### Backend (`apps/backend/.env`)

Create `apps/backend/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/wallet_tracker"
ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=your_etherscan_api_key_here
ETHERSCAN_API_URL=https://api.etherscan.io/v2/api
ETHERSCAN_CHAIN_ID=11155111
PORT=3001
FRONTEND_URL=http://localhost:3000
```

**Note**: Get a free Etherscan API key from https://etherscan.io/apis (required for fetching transactions efficiently)

**Note**: Replace `YOUR_KEY` with your actual Alchemy or Infura API key. You can get a free key from:
- [Alchemy](https://www.alchemy.com/)
- [Infura](https://www.infura.io/)

### 4. Generate Prisma Client & Run Migrations

```bash
# Generate Prisma client
pnpm --filter backend prisma generate

# Run database migrations
pnpm --filter backend prisma migrate dev
```

### 5. Start Development Servers

#### Start Both Frontend and Backend

```bash
pnpm dev
```

#### Start Individually

```bash
# Backend only (runs on http://localhost:3001)
pnpm dev:backend

# Frontend only (runs on http://localhost:3000)
pnpm dev:frontend
```

## Project Structure

```
crypto-wallet-tracker/
├── apps/
│   ├── frontend/          # Next.js frontend application
│   │   ├── src/
│   │   │   ├── app/       # Next.js App Router pages
│   │   │   └── components/ # React components
│   │   └── package.json
│   └── backend/           # NestJS backend API
│       ├── src/
│       │   ├── wallet/    # Wallet module
│       │   ├── transaction/ # Transaction module
│       │   └── prisma/    # Prisma service
│       ├── prisma/        # Prisma schema and migrations
│       └── package.json
├── packages/
│   ├── types/             # Shared TypeScript types
│   └── config/            # Shared configuration
├── package.json           # Root package.json with scripts
├── turbo.json            # Turborepo configuration
└── pnpm-workspace.yaml   # pnpm workspace configuration
```

## API Endpoints

### Wallet Endpoints

- `GET /api/wallet/:address/balance`
  - Get wallet balance in ETH
  - Example: `GET /api/wallet/0x123.../balance`

- `GET /api/wallet/:address/transactions`
  - Get wallet transactions with pagination
  - Query parameters:
    - `type` (optional): `sent` | `received`
    - `limit` (optional): number of transactions per page (default: 20, max: 100)
    - `page` (optional): page number (default: 1)
  - Returns: `{ transactions, total, page, limit, totalPages, hasMore }`
  - Example: `GET /api/wallet/0x123.../transactions?type=sent&limit=10&page=1`

### Transaction Endpoints

- `GET /api/transaction/:hash`
  - Get transaction details by hash
  - Example: `GET /api/transaction/0xabc...`

- `POST /api/transactions/sync`
  - Sync transactions for a wallet address
  - Body: `{ "address": "0x123..." }`
  - Example: `POST /api/transactions/sync`

## Usage

### 1. Connect Wallet

1. Open the application at `http://localhost:3000`
2. Click "Connect Wallet"
3. Approve the connection in MetaMask
4. Your wallet address and balance will be displayed

### 2. View Transactions

- Transactions are automatically loaded when you connect your wallet
- Use the filter buttons to view:
  - **All**: All transactions
  - **Sent**: Transactions you sent
  - **Received**: Transactions you received
- Use pagination controls at the bottom to navigate through multiple pages of transactions

### 3. View Transaction Details

- Click on any transaction in the list
- View detailed information including:
  - Transaction hash
  - From/To addresses
  - Amount
  - Block number
  - Gas used and gas price
  - Timestamp
  - Status

### 4. Sync Transactions

Use the sync endpoint to fetch and cache the latest transactions:

```bash
curl -X POST http://localhost:3001/api/transactions/sync \
  -H "Content-Type: application/json" \
  -d '{"address": "0xYourWalletAddress"}'
```

## Database Schema

### Wallet Model

```prisma
model Wallet {
  id          String        @id @default(cuid())
  address     String        @unique
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  transactions Transaction[]
}
```

### Transaction Model

```prisma
model Transaction {
  id          String   @id @default(cuid())
  hash        String   @unique
  fromAddress String
  toAddress   String
  amount      String
  blockNumber BigInt
  gasUsed     BigInt?
  gasPrice    BigInt?
  timestamp   DateTime
  status      String
  walletId    String?
  wallet      Wallet?  @relation(fields: [walletId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## Development

### Available Scripts

From the root directory:

- `pnpm dev` - Start both frontend and backend
- `pnpm dev:frontend` - Start frontend only
- `pnpm dev:backend` - Start backend only
- `pnpm build` - Build all apps
- `pnpm lint` - Lint all apps
- `pnpm test` - Run tests

### Backend Scripts

From `apps/backend`:

- `pnpm prisma:generate` - Generate Prisma client
- `pnpm prisma:migrate` - Run database migrations
- `pnpm prisma:studio` - Open Prisma Studio

## Testing

### Test Scenarios

1. **Wallet Connection**
   - Connect MetaMask wallet
   - Display wallet address and balance
   - Disconnect and reconnect
   - Switch accounts in MetaMask

2. **Transaction List**
   - View recent transactions
   - Filter by sent/received
   - Navigate to transaction detail
   - Handle wallet with no transactions

3. **Transaction Details**
   - View full transaction details
   - Navigate back to list
   - Handle invalid transaction hash

4. **Error Handling**
   - Network errors
   - Invalid wallet address
   - RPC errors
   - Database errors

## Troubleshooting

### Backend won't start

- Check that PostgreSQL is running
- Verify `DATABASE_URL` in `apps/backend/.env`
- Run `pnpm --filter backend prisma migrate dev` to create tables

### Frontend can't connect to backend

- Ensure backend is running on port 3001
- Check `NEXT_PUBLIC_API_URL` in `apps/frontend/.env.local`
- Verify CORS settings in `apps/backend/src/main.ts`

### No transactions showing

- The app fetches transactions by scanning recent blocks
- For wallets with many transactions, use the sync endpoint
- Consider using an Etherscan API for production

### Prisma errors

- Run `pnpm --filter backend prisma generate` after schema changes
- Run `pnpm --filter backend prisma migrate dev` to apply migrations

## Production Considerations

1. **Use a Production RPC Provider**: Use Alchemy or Infura with rate limiting
2. **Index Transactions**: Consider using Etherscan API or indexing service for better transaction fetching
3. **Rate Limiting**: Add rate limiting to API endpoints
4. **Error Monitoring**: Add error tracking (Sentry, etc.)
5. **Database Optimization**: Add indexes for frequently queried fields
6. **Caching**: Implement Redis for frequently accessed data

## Testing

### Run Unit Tests

```bash
# Run all tests
pnpm --filter backend test

# Run tests with coverage
pnpm --filter backend test:cov

# Run tests in watch mode
pnpm --filter backend test:watch
```

### Test Coverage

The project includes unit tests for critical backend services:
- `WalletService`: Tests for balance fetching and transaction retrieval
- `TransactionService`: Tests for transaction details and tag updates

## API Documentation

### Swagger/OpenAPI

Once the backend is running, visit:
```
http://localhost:3001/api/docs
```

The Swagger UI provides:
- Interactive API documentation
- Request/response schemas
- Try-it-out functionality for all endpoints

## Docker Deployment

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

### Quick Start with Docker

1. **Create environment file** (`.env` in project root):
```env
ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=your_etherscan_api_key_here
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_CHAIN_ID=11155111
```

2. **Build and start all services**:
```bash
docker-compose up -d
```

This will start:
- PostgreSQL database (port 5432)
- Backend API (port 3001)
- Frontend (port 3000)

3. **View logs**:
```bash
docker-compose logs -f
```

4. **Stop services**:
```bash
docker-compose down
```

### Docker Commands

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Stop services
docker-compose stop

# Remove containers and volumes
docker-compose down -v

# Rebuild and restart
docker-compose up -d --build

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Database Migrations

Migrations run automatically when the backend container starts. To run manually:

```bash
docker-compose exec backend pnpm prisma migrate deploy
```

## Production Deployment

### Option 1: Docker Compose (Recommended)

1. **Set up environment variables**:
   - Create `.env` file with production values
   - Use strong database passwords
   - Configure production RPC URLs

2. **Deploy**:
```bash
docker-compose -f docker-compose.yml up -d
```

3. **Set up reverse proxy** (Nginx example):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Option 2: Manual Deployment

#### Backend Deployment

1. **Build the application**:
```bash
cd apps/backend
pnpm install --prod
pnpm build
```

2. **Set up environment variables**:
```env
DATABASE_URL=postgresql://user:password@host:5432/wallet_tracker
ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=your_etherscan_api_key
PORT=3001
FRONTEND_URL=https://your-domain.com
```

3. **Run database migrations**:
```bash
pnpm prisma migrate deploy
```

4. **Start the application**:
```bash
pnpm start:prod
```

#### Frontend Deployment

1. **Build the application**:
```bash
cd apps/frontend
pnpm install
pnpm build
```

2. **Set environment variables**:
```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com/api
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_CHAIN_ID=11155111
```

3. **Start the application**:
```bash
pnpm start
```

### Option 3: Cloud Platforms

#### Vercel (Frontend)

1. Connect your GitHub repository
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push

#### Railway / Render (Backend)

1. Connect your GitHub repository
2. Set environment variables
3. Configure build command: `pnpm --filter backend build`
4. Configure start command: `cd apps/backend && pnpm start:prod`

#### AWS / GCP / Azure

Use container services (ECS, Cloud Run, Container Instances) with the provided Dockerfiles.

### Security Considerations

- Use environment variables for all secrets
- Enable HTTPS in production
- Configure CORS properly
- Use rate limiting (already configured)
- Keep dependencies updated
- Use strong database passwords
- Enable database backups

### Monitoring

- Set up health check endpoints
- Monitor API response times
- Track error rates
- Monitor database performance
- Set up alerts for critical failures

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

