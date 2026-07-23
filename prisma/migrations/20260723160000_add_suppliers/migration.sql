-- CreateTable
CREATE TABLE "suppliers" (
    "id" SERIAL NOT NULL,
    "legal_name" VARCHAR(255) NOT NULL,
    "trade_name" VARCHAR(255) NOT NULL,
    "cnpj" VARCHAR(18) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "website" VARCHAR(255),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_cnpj_key" ON "suppliers"("cnpj");

-- AddColumn (nullable first for backfill)
ALTER TABLE "stock_batches" ADD COLUMN "supplier_id" INTEGER;

-- Backfill existing batches with a placeholder supplier when needed
DO $$
DECLARE
  placeholder_id INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM "stock_batches" WHERE "supplier_id" IS NULL) THEN
    INSERT INTO "suppliers" ("legal_name", "trade_name", "cnpj", "phone", "email", "website")
    VALUES (
      'Fornecedor Migracao LTDA',
      'Fornecedor Migracao',
      '00000000000000',
      '0000000000',
      'migracao@local',
      NULL
    )
    RETURNING "id" INTO placeholder_id;

    UPDATE "stock_batches"
    SET "supplier_id" = placeholder_id
    WHERE "supplier_id" IS NULL;
  END IF;
END $$;

-- AlterColumn to NOT NULL
ALTER TABLE "stock_batches" ALTER COLUMN "supplier_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "stock_batches"
ADD CONSTRAINT "stock_batches_supplier_id_fkey"
FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
