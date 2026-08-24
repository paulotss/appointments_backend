-- CreateEnum
CREATE TYPE "payment_method_enum" AS ENUM ('pix', 'debito', 'credito', 'dinheiro', 'transferencia');

-- CreateEnum
CREATE TYPE "financial_entry_type_enum" AS ENUM ('procedimento_particular', 'plano_de_saude');

-- CreateEnum
CREATE TYPE "financial_entry_status_enum" AS ENUM ('pendente', 'pago', 'parcialmente_pago', 'cancelado');

-- CreateEnum
CREATE TYPE "payable_kind_enum" AS ENUM ('material', 'servico');

-- CreateEnum
CREATE TYPE "payable_status_enum" AS ENUM ('pendente', 'pago', 'cancelado');

-- CreateEnum
CREATE TYPE "billing_batch_status_enum" AS ENUM ('aberto', 'faturado', 'baixado', 'cancelado');

-- CreateTable
CREATE TABLE "financial_entries" (
    "id" SERIAL NOT NULL,
    "type" "financial_entry_type_enum" NOT NULL,
    "status" "financial_entry_status_enum" NOT NULL,
    "gross_amount" DECIMAL(10,2) NOT NULL,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "surcharge_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(10,2) NOT NULL,
    "received_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_method" "payment_method_enum",
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "clinical_appointment_id" INTEGER,
    "billing_batch_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_entry_items" (
    "id" SERIAL NOT NULL,
    "financial_entry_id" INTEGER NOT NULL,
    "procedure_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_value" DECIMAL(10,2) NOT NULL,
    "description" VARCHAR(150) NOT NULL,

    CONSTRAINT "financial_entry_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payables" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "kind" "payable_kind_enum" NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "invoice_number" VARCHAR(60),
    "notes" TEXT,
    "status" "payable_status_enum" NOT NULL DEFAULT 'pendente',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_exits" (
    "id" SERIAL NOT NULL,
    "payable_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_method" "payment_method_enum" NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_exits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_documents" (
    "id" SERIAL NOT NULL,
    "payable_id" INTEGER NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_batches" (
    "id" SERIAL NOT NULL,
    "health_plan_id" INTEGER NOT NULL,
    "status" "billing_batch_status_enum" NOT NULL DEFAULT 'aberto',
    "billed_amount" DECIMAL(10,2) NOT NULL,
    "received_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "billed_at" TIMESTAMP(3),
    "settled_at" TIMESTAMP(3),
    "protocol_number" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_batch_guides" (
    "id" SERIAL NOT NULL,
    "billing_batch_id" INTEGER NOT NULL,
    "insurance_guide_id" INTEGER NOT NULL,
    "billed_amount" DECIMAL(10,2) NOT NULL,
    "received_amount" DECIMAL(10,2),
    "glosa_reason" TEXT,

    CONSTRAINT "billing_batch_guides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financial_entries_clinical_appointment_id_key" ON "financial_entries"("clinical_appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_entries_billing_batch_id_key" ON "financial_entries"("billing_batch_id");

-- CreateIndex
CREATE INDEX "financial_entries_type_idx" ON "financial_entries"("type");

-- CreateIndex
CREATE INDEX "financial_entries_status_idx" ON "financial_entries"("status");

-- CreateIndex
CREATE INDEX "financial_entries_created_at_idx" ON "financial_entries"("created_at");

-- CreateIndex
CREATE INDEX "financial_entries_paid_at_idx" ON "financial_entries"("paid_at");

-- CreateIndex
CREATE INDEX "financial_entry_items_procedure_id_idx" ON "financial_entry_items"("procedure_id");

-- CreateIndex
CREATE INDEX "payables_supplier_id_idx" ON "payables"("supplier_id");

-- CreateIndex
CREATE INDEX "payables_status_idx" ON "payables"("status");

-- CreateIndex
CREATE INDEX "payables_due_date_idx" ON "payables"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "financial_exits_payable_id_key" ON "financial_exits"("payable_id");

-- CreateIndex
CREATE INDEX "financial_exits_paid_at_idx" ON "financial_exits"("paid_at");

-- CreateIndex
CREATE INDEX "financial_exits_payment_method_idx" ON "financial_exits"("payment_method");

-- CreateIndex
CREATE INDEX "financial_documents_payable_id_idx" ON "financial_documents"("payable_id");

-- CreateIndex
CREATE INDEX "billing_batches_health_plan_id_idx" ON "billing_batches"("health_plan_id");

-- CreateIndex
CREATE INDEX "billing_batches_status_idx" ON "billing_batches"("status");

-- CreateIndex
CREATE INDEX "billing_batches_created_at_idx" ON "billing_batches"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "billing_batch_guides_insurance_guide_id_key" ON "billing_batch_guides"("insurance_guide_id");

-- CreateIndex
CREATE INDEX "billing_batch_guides_billing_batch_id_idx" ON "billing_batch_guides"("billing_batch_id");

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_clinical_appointment_id_fkey" FOREIGN KEY ("clinical_appointment_id") REFERENCES "clinical_appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_billing_batch_id_fkey" FOREIGN KEY ("billing_batch_id") REFERENCES "billing_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entry_items" ADD CONSTRAINT "financial_entry_items_financial_entry_id_fkey" FOREIGN KEY ("financial_entry_id") REFERENCES "financial_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entry_items" ADD CONSTRAINT "financial_entry_items_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_exits" ADD CONSTRAINT "financial_exits_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "payables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "payables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_batches" ADD CONSTRAINT "billing_batches_health_plan_id_fkey" FOREIGN KEY ("health_plan_id") REFERENCES "health_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_batch_guides" ADD CONSTRAINT "billing_batch_guides_billing_batch_id_fkey" FOREIGN KEY ("billing_batch_id") REFERENCES "billing_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_batch_guides" ADD CONSTRAINT "billing_batch_guides_insurance_guide_id_fkey" FOREIGN KEY ("insurance_guide_id") REFERENCES "insurance_guides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
