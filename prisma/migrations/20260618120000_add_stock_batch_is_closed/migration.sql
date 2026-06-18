-- AlterTable
ALTER TABLE "stock_batches" ADD COLUMN "is_closed" BOOLEAN NOT NULL DEFAULT false;

-- Fechar lotes existentes sem saldo
UPDATE "stock_batches" SET "is_closed" = true WHERE "current_quantity" = 0;
