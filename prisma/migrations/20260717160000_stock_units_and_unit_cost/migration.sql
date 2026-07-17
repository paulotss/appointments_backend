-- CreateEnum
CREATE TYPE "stock_unit_enum" AS ENUM ('UNIT', 'BOX');

-- AlterTable products
ALTER TABLE "products" ADD COLUMN "base_unit" "stock_unit_enum" NOT NULL DEFAULT 'UNIT';
ALTER TABLE "products" ADD COLUMN "units_per_package" INTEGER NOT NULL DEFAULT 1;

-- Rename value → unit_cost (existing values treated as cost per base unit)
ALTER TABLE "stock_batches" RENAME COLUMN "value" TO "unit_cost";
ALTER TABLE "stock_batches" ALTER COLUMN "unit_cost" TYPE DECIMAL(10, 4);
