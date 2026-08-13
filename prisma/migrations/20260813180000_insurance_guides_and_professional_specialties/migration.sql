-- CreateTable
CREATE TABLE "health_professional_specialties" (
    "id" SERIAL NOT NULL,
    "health_professional_id" INTEGER NOT NULL,
    "specialty_id" INTEGER NOT NULL,
    "private_price" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "health_professional_specialties_pkey" PRIMARY KEY ("id")
);

-- Migrate existing specialty links
INSERT INTO "health_professional_specialties" ("health_professional_id", "specialty_id", "private_price")
SELECT "id", "specialty_id", 0
FROM "health_professionals";

-- DropForeignKey
ALTER TABLE "health_professionals" DROP CONSTRAINT "health_professionals_specialty_id_fkey";

-- DropColumn
ALTER TABLE "health_professionals" DROP COLUMN "specialty_id";

-- CreateIndex
CREATE UNIQUE INDEX "health_professional_specialties_health_professional_id_specialty_id_key" ON "health_professional_specialties"("health_professional_id", "specialty_id");

-- CreateIndex
CREATE INDEX "health_professional_specialties_specialty_id_idx" ON "health_professional_specialties"("specialty_id");

-- AddForeignKey
ALTER TABLE "health_professional_specialties" ADD CONSTRAINT "health_professional_specialties_health_professional_id_fkey" FOREIGN KEY ("health_professional_id") REFERENCES "health_professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_professional_specialties" ADD CONSTRAINT "health_professional_specialties_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Remove default after migration (schema has no default)
ALTER TABLE "health_professional_specialties" ALTER COLUMN "private_price" DROP DEFAULT;

-- CreateTable
CREATE TABLE "health_plans" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "submission_deadline_days" INTEGER NOT NULL,

    CONSTRAINT "health_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(150),
    "birth_date" DATE NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patients_cpf_key" ON "patients"("cpf");

-- CreateTable
CREATE TABLE "insurance_cards" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "health_plan_id" INTEGER NOT NULL,
    "card_number" VARCHAR(50) NOT NULL,
    "expiration_date" DATE NOT NULL,

    CONSTRAINT "insurance_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insurance_cards_patient_id_idx" ON "insurance_cards"("patient_id");

-- CreateIndex
CREATE INDEX "insurance_cards_health_plan_id_idx" ON "insurance_cards"("health_plan_id");

-- CreateIndex
CREATE INDEX "insurance_cards_expiration_date_idx" ON "insurance_cards"("expiration_date");

-- AddForeignKey
ALTER TABLE "insurance_cards" ADD CONSTRAINT "insurance_cards_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_cards" ADD CONSTRAINT "insurance_cards_health_plan_id_fkey" FOREIGN KEY ("health_plan_id") REFERENCES "health_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "insurance_guides" (
    "id" SERIAL NOT NULL,
    "health_plan_id" INTEGER NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "specialty_id" INTEGER NOT NULL,
    "health_professional_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiration_date" DATE NOT NULL,

    CONSTRAINT "insurance_guides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insurance_guides_patient_id_idx" ON "insurance_guides"("patient_id");

-- CreateIndex
CREATE INDEX "insurance_guides_health_plan_id_idx" ON "insurance_guides"("health_plan_id");

-- CreateIndex
CREATE INDEX "insurance_guides_specialty_id_idx" ON "insurance_guides"("specialty_id");

-- CreateIndex
CREATE INDEX "insurance_guides_health_professional_id_idx" ON "insurance_guides"("health_professional_id");

-- CreateIndex
CREATE INDEX "insurance_guides_expiration_date_idx" ON "insurance_guides"("expiration_date");

-- AddForeignKey
ALTER TABLE "insurance_guides" ADD CONSTRAINT "insurance_guides_health_plan_id_fkey" FOREIGN KEY ("health_plan_id") REFERENCES "health_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_guides" ADD CONSTRAINT "insurance_guides_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_guides" ADD CONSTRAINT "insurance_guides_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_guides" ADD CONSTRAINT "insurance_guides_health_professional_id_fkey" FOREIGN KEY ("health_professional_id") REFERENCES "health_professionals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
