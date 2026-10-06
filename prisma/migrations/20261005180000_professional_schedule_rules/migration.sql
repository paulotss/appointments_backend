-- AlterEnum
ALTER TYPE "service_token_scope" ADD VALUE 'AGENT_DATA_WRITE';

-- CreateTable
CREATE TABLE "professional_schedule_rules" (
    "id" SERIAL NOT NULL,
    "health_professional_id" INTEGER NOT NULL,
    "procedure_id" INTEGER NOT NULL,
    "max_concurrent_appointments" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "slot_interval_minutes" INTEGER NOT NULL,
    "allow_overbooking" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(500),

    CONSTRAINT "professional_schedule_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_schedule_rule_windows" (
    "id" SERIAL NOT NULL,
    "rule_id" INTEGER NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,

    CONSTRAINT "professional_schedule_rule_windows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "professional_schedule_rules_health_professional_id_procedure_id_key" ON "professional_schedule_rules"("health_professional_id", "procedure_id");

-- CreateIndex
CREATE INDEX "professional_schedule_rules_procedure_id_idx" ON "professional_schedule_rules"("procedure_id");

-- CreateIndex
CREATE INDEX "professional_schedule_rule_windows_rule_id_weekday_idx" ON "professional_schedule_rule_windows"("rule_id", "weekday");

-- AddForeignKey
ALTER TABLE "professional_schedule_rules" ADD CONSTRAINT "professional_schedule_rules_health_professional_id_fkey" FOREIGN KEY ("health_professional_id") REFERENCES "health_professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_schedule_rules" ADD CONSTRAINT "professional_schedule_rules_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_schedule_rule_windows" ADD CONSTRAINT "professional_schedule_rule_windows_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "professional_schedule_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
