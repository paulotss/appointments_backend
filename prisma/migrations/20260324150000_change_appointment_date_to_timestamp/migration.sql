-- Alter appointment date column to store date and time.
ALTER TABLE "appointments"
ALTER COLUMN "date" TYPE TIMESTAMP(3)
USING "date"::TIMESTAMP(3);
