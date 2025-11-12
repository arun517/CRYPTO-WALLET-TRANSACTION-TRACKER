# How to Check Token Data in Database

## Method 1: Using Prisma Studio (Recommended)

1. Open Prisma Studio:
   ```bash
   cd apps/backend
   pnpm prisma:studio
   ```

2. In Prisma Studio:
   - Click on the **Transaction** model
   - Look for columns: `tokenContractAddress`, `tokenName`, `tokenSymbol`, `tokenAmountFormatted`
   - Filter by: `tokenContractAddress` is not null
   - You should see transactions with token information populated

## Method 2: Using SQLite Command Line

```bash
cd apps/backend
sqlite3 prisma/dev.db
```

Then run:
```sql
-- See all token fields for transactions with tokens
SELECT 
  hash,
  amount,
  tokenContractAddress,
  tokenName,
  tokenSymbol,
  tokenDecimals,
  tokenAmount,
  tokenAmountFormatted
FROM Transaction 
WHERE tokenContractAddress IS NOT NULL 
LIMIT 10;

-- Count transactions with tokens
SELECT 
  COUNT(*) as total,
  COUNT(tokenContractAddress) as with_tokens
FROM Transaction;
```

## Method 3: Check via API

The token information should be visible when you:
1. Fetch a transaction by hash that has token info
2. View transactions in the frontend - token amounts should display

## Troubleshooting

If you don't see token data:
1. Run the backfill script: `pnpm backfill:tokens`
2. Check if transactions actually have token transfers (not all transactions are token transfers)
3. Verify the migration was applied: `pnpm prisma:migrate status`

