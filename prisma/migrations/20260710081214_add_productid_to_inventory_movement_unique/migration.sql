/*
  Warnings:

  - A unique constraint covering the columns `[referenceType,referenceId,reason,productId]` on the table `InventoryMovement` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "InventoryMovement_referenceType_referenceId_reason_key";

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_referenceType_referenceId_reason_productI_key" ON "InventoryMovement"("referenceType", "referenceId", "reason", "productId");
