ALTER TYPE "council_type_enum" ADD VALUE 'CRESS';
ALTER TYPE "council_type_enum" ADD VALUE 'CRF';
ALTER TYPE "council_type_enum" ADD VALUE 'CREFONO';
ALTER TYPE "council_type_enum" ADD VALUE 'CREFITO';
ALTER TYPE "council_type_enum" ADD VALUE 'CRN';
ALTER TYPE "council_type_enum" ADD VALUE 'CRBIO';
ALTER TYPE "council_type_enum" ADD VALUE 'CRBM';
ALTER TYPE "council_type_enum" ADD VALUE 'CREF';
ALTER TYPE "council_type_enum" ADD VALUE 'CRMV';
ALTER TYPE "council_type_enum" ADD VALUE 'CRTR';

CREATE TABLE "requesting_professionals" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "council_type" "council_type_enum" NOT NULL,
    "council_number" VARCHAR(30) NOT NULL,
    "council_uf" VARCHAR(2) NOT NULL,
    "cbos_code" VARCHAR(6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requesting_professionals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "requesting_professionals_identity_cbos_key" ON "requesting_professionals"("council_type", "council_number", "council_uf", "cbos_code");
CREATE INDEX "requesting_professionals_name_idx" ON "requesting_professionals"("name");

ALTER TABLE "insurance_guides" ADD COLUMN "executor_cbos_code" VARCHAR(6);
ALTER TABLE "insurance_guides" ADD COLUMN "requester_name" VARCHAR(150);
ALTER TABLE "insurance_guides" ADD COLUMN "requester_council_type" "council_type_enum";
ALTER TABLE "insurance_guides" ADD COLUMN "requester_council_number" VARCHAR(30);
ALTER TABLE "insurance_guides" ADD COLUMN "requester_council_uf" VARCHAR(2);
ALTER TABLE "insurance_guides" ADD COLUMN "requester_cbos_code" VARCHAR(6);
