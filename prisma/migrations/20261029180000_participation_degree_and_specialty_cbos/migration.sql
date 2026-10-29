-- AlterTable
ALTER TABLE "specialties" ADD COLUMN "cbos_code" VARCHAR(6);

-- Copia o CBO-S do profissional para a especialidade somente quando todos
-- os profissionais daquela especialidade compartilham o mesmo código.
UPDATE "specialties" AS s
SET "cbos_code" = sub.cbos
FROM (
    SELECT
        hps.specialty_id,
        MIN(hp.cbos_code) AS cbos
    FROM "health_professional_specialties" AS hps
    JOIN "health_professionals" AS hp ON hp.id = hps.health_professional_id
    WHERE hp.cbos_code IS NOT NULL AND btrim(hp.cbos_code) <> ''
    GROUP BY hps.specialty_id
    HAVING COUNT(DISTINCT hp.cbos_code) = 1
) AS sub
WHERE s.id = sub.specialty_id;

-- AlterTable
ALTER TABLE "insurance_guides"
ADD COLUMN "participation_degree" VARCHAR(2) NOT NULL DEFAULT '12';

-- AlterTable
ALTER TABLE "health_professionals" DROP COLUMN "cbos_code";
