-- CreateEnum
CREATE TYPE "council_type_enum" AS ENUM ('CRM', 'CRO', 'CRP', 'COREN', 'OTHER');

-- CreateTable
CREATE TABLE "health_professionals" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "specialty_id" INTEGER NOT NULL,
    "council_type" "council_type_enum" NOT NULL,
    "council_number" VARCHAR(30) NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,
    "phone" VARCHAR(20),
    "email" VARCHAR(150),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "registered_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_professionals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "health_professionals_cpf_key" ON "health_professionals"("cpf");

-- AddForeignKey
ALTER TABLE "health_professionals" ADD CONSTRAINT "health_professionals_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "stock_exits" ADD COLUMN "health_professional_id" INTEGER;

-- AddForeignKey
ALTER TABLE "stock_exits" ADD CONSTRAINT "stock_exits_health_professional_id_fkey" FOREIGN KEY ("health_professional_id") REFERENCES "health_professionals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
