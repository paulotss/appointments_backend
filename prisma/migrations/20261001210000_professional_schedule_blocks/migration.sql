-- CreateEnum
CREATE TYPE "schedule_exception_kind_enum" AS ENUM ('block', 'release');

-- CreateTable
CREATE TABLE "professional_weekly_blocks" (
    "id" SERIAL NOT NULL,
    "health_professional_id" INTEGER NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,

    CONSTRAINT "professional_weekly_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_day_exceptions" (
    "id" SERIAL NOT NULL,
    "health_professional_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "kind" "schedule_exception_kind_enum" NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "note" VARCHAR(200),

    CONSTRAINT "professional_day_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "professional_weekly_blocks_health_professional_id_weekday_idx" ON "professional_weekly_blocks"("health_professional_id", "weekday");

-- CreateIndex
CREATE INDEX "professional_day_exceptions_health_professional_id_date_idx" ON "professional_day_exceptions"("health_professional_id", "date");

-- AddForeignKey
ALTER TABLE "professional_weekly_blocks" ADD CONSTRAINT "professional_weekly_blocks_health_professional_id_fkey" FOREIGN KEY ("health_professional_id") REFERENCES "health_professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_day_exceptions" ADD CONSTRAINT "professional_day_exceptions_health_professional_id_fkey" FOREIGN KEY ("health_professional_id") REFERENCES "health_professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
