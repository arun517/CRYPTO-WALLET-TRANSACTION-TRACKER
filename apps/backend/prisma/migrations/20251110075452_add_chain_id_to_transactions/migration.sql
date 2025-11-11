-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hash" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "gasUsed" BIGINT,
    "gasPrice" BIGINT,
    "timestamp" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL DEFAULT 11155111,
    "walletId" TEXT,
    "tags" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "blockNumber", "createdAt", "fromAddress", "gasPrice", "gasUsed", "hash", "id", "notes", "status", "tags", "timestamp", "toAddress", "updatedAt", "walletId") SELECT "amount", "blockNumber", "createdAt", "fromAddress", "gasPrice", "gasUsed", "hash", "id", "notes", "status", "tags", "timestamp", "toAddress", "updatedAt", "walletId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE UNIQUE INDEX "Transaction_hash_key" ON "Transaction"("hash");
CREATE INDEX "Transaction_fromAddress_idx" ON "Transaction"("fromAddress");
CREATE INDEX "Transaction_toAddress_idx" ON "Transaction"("toAddress");
CREATE INDEX "Transaction_timestamp_idx" ON "Transaction"("timestamp");
CREATE INDEX "Transaction_chainId_idx" ON "Transaction"("chainId");
CREATE UNIQUE INDEX "Transaction_hash_chainId_key" ON "Transaction"("hash", "chainId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
