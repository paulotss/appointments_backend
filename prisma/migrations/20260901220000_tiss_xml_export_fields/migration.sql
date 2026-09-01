-- CreateEnum
CREATE TYPE "tiss_guide_type_enum" AS ENUM ('consulta', 'sp_sadt');

-- CreateTable
CREATE TABLE "clinic_profiles" (
    "id" INTEGER NOT NULL,
    "legal_name" VARCHAR(255),
    "cnpj" VARCHAR(14),
    "cnes" VARCHAR(7),

    CONSTRAINT "clinic_profiles_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "health_professionals" ADD COLUMN "council_uf" VARCHAR(2);
ALTER TABLE "health_professionals" ADD COLUMN "cbos_code" VARCHAR(6);

-- AlterTable
ALTER TABLE "health_plans" ADD COLUMN "registro_ans" VARCHAR(6);
ALTER TABLE "health_plans" ADD COLUMN "provider_code" VARCHAR(20);
ALTER TABLE "health_plans" ADD COLUMN "tiss_version" VARCHAR(10) NOT NULL DEFAULT '4.03.00';

-- AlterTable
ALTER TABLE "procedures" ADD COLUMN "tiss_guide_type" "tiss_guide_type_enum" NOT NULL DEFAULT 'sp_sadt';

UPDATE "procedures" AS p
SET "tiss_guide_type" = 'consulta'
WHERE EXISTS (
    SELECT 1
    FROM "health_plan_procedures" AS hpp
    WHERE hpp.procedure_id = p.id
)
AND NOT EXISTS (
    SELECT 1
    FROM "health_plan_procedures" AS hpp
    WHERE hpp.procedure_id = p.id
      AND left(btrim(hpp.tiss_code), 4) <> '1010'
);

-- AlterTable
ALTER TABLE "insurance_guides" ADD COLUMN "tiss_guide_type" "tiss_guide_type_enum";

UPDATE "insurance_guides" AS g
SET "tiss_guide_type" = sub.tipo::"tiss_guide_type_enum"
FROM (
    SELECT
        igp.insurance_guide_id,
        MIN(p.tiss_guide_type::text) AS tipo
    FROM "insurance_guide_procedures" AS igp
    JOIN "procedures" AS p ON p.id = igp.procedure_id
    GROUP BY igp.insurance_guide_id
    HAVING COUNT(DISTINCT p.tiss_guide_type) = 1
) AS sub
WHERE g.id = sub.insurance_guide_id;

CREATE INDEX "insurance_guides_tiss_guide_type_idx" ON "insurance_guides"("tiss_guide_type");
