-- CreateEnum
CREATE TYPE "call_status_enum" AS ENUM ('ATENDIDO', 'NÃO ATENDIDO', 'REALIZADO');

-- AlterTable
ALTER TABLE "calls" ADD COLUMN "destination" VARCHAR(255) NOT NULL DEFAULT '';

ALTER TABLE "calls" ALTER COLUMN "destination" DROP DEFAULT;

ALTER TABLE "calls" ALTER COLUMN "status" TYPE "call_status_enum" USING (
  CASE
    WHEN "status" = 'ATENDIDO' THEN 'ATENDIDO'::"call_status_enum"
    WHEN "status" IN ('NÃO ATENDIDO', 'NAO_ATENDIDO') THEN 'NÃO ATENDIDO'::"call_status_enum"
    WHEN "status" = 'REALIZADO' THEN 'REALIZADO'::"call_status_enum"
    ELSE 'REALIZADO'::"call_status_enum"
  END
);
