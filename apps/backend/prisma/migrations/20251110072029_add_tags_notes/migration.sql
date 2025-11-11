-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "notes" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "tags" TEXT;

-- CreateTable
CREATE TABLE "SavedAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedAddress_address_key" ON "SavedAddress"("address");
