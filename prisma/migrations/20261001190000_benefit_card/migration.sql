-- AlterEnum
ALTER TYPE "clinical_appointment_procedure_origin_enum" ADD VALUE 'cartao';

-- AlterEnum
ALTER TYPE "financial_entry_type_enum" ADD VALUE 'assinatura_cartao';

-- CreateEnum
CREATE TYPE "benefit_kind_enum" AS ENUM ('cota', 'desconto');

-- CreateEnum
CREATE TYPE "benefit_subscription_status_enum" AS ENUM ('ativo', 'cancelado');

-- CreateTable
CREATE TABLE "benefit_plans" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "annual_price" DECIMAL(10,2) NOT NULL,
    "adhesion_fee" DECIMAL(10,2) NOT NULL DEFAULT 20,
    "dependent_fee" DECIMAL(10,2) NOT NULL DEFAULT 5,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benefit_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefits" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "kind" "benefit_kind_enum" NOT NULL,
    "quantity" INTEGER,
    "discount_percent" DECIMAL(5,2),

    CONSTRAINT "benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_procedures" (
    "id" SERIAL NOT NULL,
    "benefit_id" INTEGER NOT NULL,
    "procedure_id" INTEGER NOT NULL,

    CONSTRAINT "benefit_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_subscriptions" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "starts_at" DATE NOT NULL,
    "expires_at" DATE NOT NULL,
    "billing_day" INTEGER NOT NULL,
    "installment_count" INTEGER NOT NULL,
    "status" "benefit_subscription_status_enum" NOT NULL DEFAULT 'ativo',
    "card_number" VARCHAR(20) NOT NULL,
    "pagbank_subscription_id" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benefit_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_subscription_dependents" (
    "id" SERIAL NOT NULL,
    "subscription_id" INTEGER NOT NULL,
    "patient_id" INTEGER NOT NULL,

    CONSTRAINT "benefit_subscription_dependents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_entitlements" (
    "id" SERIAL NOT NULL,
    "subscription_id" INTEGER NOT NULL,
    "benefit_id" INTEGER NOT NULL,
    "kind" "benefit_kind_enum" NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "quantity" INTEGER,
    "used_quantity" INTEGER NOT NULL DEFAULT 0,
    "discount_percent" DECIMAL(5,2),

    CONSTRAINT "benefit_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_entitlement_procedures" (
    "id" SERIAL NOT NULL,
    "entitlement_id" INTEGER NOT NULL,
    "procedure_id" INTEGER NOT NULL,

    CONSTRAINT "benefit_entitlement_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_notes" (
    "id" SERIAL NOT NULL,
    "entitlement_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benefit_notes_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "clinical_appointment_procedures" ADD COLUMN "benefit_entitlement_id" INTEGER;

-- AlterTable
ALTER TABLE "financial_entries" ADD COLUMN "benefit_subscription_id" INTEGER,
ADD COLUMN "due_date" DATE,
ADD COLUMN "installment_number" INTEGER;

-- CreateIndex
CREATE INDEX "benefits_plan_id_idx" ON "benefits"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "benefit_procedures_benefit_id_procedure_id_key" ON "benefit_procedures"("benefit_id", "procedure_id");

-- CreateIndex
CREATE INDEX "benefit_procedures_procedure_id_idx" ON "benefit_procedures"("procedure_id");

-- CreateIndex
CREATE UNIQUE INDEX "benefit_subscriptions_card_number_key" ON "benefit_subscriptions"("card_number");

-- CreateIndex
CREATE INDEX "benefit_subscriptions_patient_id_idx" ON "benefit_subscriptions"("patient_id");

-- CreateIndex
CREATE INDEX "benefit_subscriptions_plan_id_idx" ON "benefit_subscriptions"("plan_id");

-- CreateIndex
CREATE INDEX "benefit_subscriptions_status_idx" ON "benefit_subscriptions"("status");

-- CreateIndex
CREATE INDEX "benefit_subscriptions_expires_at_idx" ON "benefit_subscriptions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "benefit_subscription_dependents_subscription_id_patient_id_key" ON "benefit_subscription_dependents"("subscription_id", "patient_id");

-- CreateIndex
CREATE INDEX "benefit_subscription_dependents_patient_id_idx" ON "benefit_subscription_dependents"("patient_id");

-- CreateIndex
CREATE INDEX "benefit_entitlements_subscription_id_idx" ON "benefit_entitlements"("subscription_id");

-- CreateIndex
CREATE INDEX "benefit_entitlements_benefit_id_idx" ON "benefit_entitlements"("benefit_id");

-- CreateIndex
CREATE UNIQUE INDEX "benefit_entitlement_procedures_entitlement_id_procedure_id_key" ON "benefit_entitlement_procedures"("entitlement_id", "procedure_id");

-- CreateIndex
CREATE INDEX "benefit_entitlement_procedures_procedure_id_idx" ON "benefit_entitlement_procedures"("procedure_id");

-- CreateIndex
CREATE INDEX "benefit_notes_entitlement_id_idx" ON "benefit_notes"("entitlement_id");

-- CreateIndex
CREATE INDEX "clinical_appointment_procedures_benefit_entitlement_id_idx" ON "clinical_appointment_procedures"("benefit_entitlement_id");

-- CreateIndex
CREATE INDEX "financial_entries_benefit_subscription_id_idx" ON "financial_entries"("benefit_subscription_id");

-- CreateIndex
CREATE INDEX "financial_entries_due_date_idx" ON "financial_entries"("due_date");

-- AddForeignKey
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "benefit_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_procedures" ADD CONSTRAINT "benefit_procedures_benefit_id_fkey" FOREIGN KEY ("benefit_id") REFERENCES "benefits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_procedures" ADD CONSTRAINT "benefit_procedures_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_subscriptions" ADD CONSTRAINT "benefit_subscriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_subscriptions" ADD CONSTRAINT "benefit_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "benefit_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_subscription_dependents" ADD CONSTRAINT "benefit_subscription_dependents_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "benefit_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_subscription_dependents" ADD CONSTRAINT "benefit_subscription_dependents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_entitlements" ADD CONSTRAINT "benefit_entitlements_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "benefit_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_entitlements" ADD CONSTRAINT "benefit_entitlements_benefit_id_fkey" FOREIGN KEY ("benefit_id") REFERENCES "benefits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_entitlement_procedures" ADD CONSTRAINT "benefit_entitlement_procedures_entitlement_id_fkey" FOREIGN KEY ("entitlement_id") REFERENCES "benefit_entitlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_entitlement_procedures" ADD CONSTRAINT "benefit_entitlement_procedures_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_notes" ADD CONSTRAINT "benefit_notes_entitlement_id_fkey" FOREIGN KEY ("entitlement_id") REFERENCES "benefit_entitlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_appointment_procedures" ADD CONSTRAINT "clinical_appointment_procedures_benefit_entitlement_id_fkey" FOREIGN KEY ("benefit_entitlement_id") REFERENCES "benefit_entitlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_benefit_subscription_id_fkey" FOREIGN KEY ("benefit_subscription_id") REFERENCES "benefit_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
