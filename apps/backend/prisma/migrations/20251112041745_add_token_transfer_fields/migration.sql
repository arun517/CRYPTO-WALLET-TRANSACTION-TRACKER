/*
  Warnings:

  - You are about to drop the `SavedAddress` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "tokenAmount" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "tokenAmountFormatted" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "tokenContractAddress" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "tokenDecimals" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN "tokenName" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "tokenSymbol" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SavedAddress";
PRAGMA foreign_keys=on;

-- CreateIndex
CREATE INDEX "Transaction_tokenContractAddress_idx" ON "Transaction"("tokenContractAddress");
