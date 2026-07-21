-- AlterTable
ALTER TABLE "messages" ADD COLUMN "name" VARCHAR(150) NOT NULL DEFAULT '';

-- DropDefault (keep column required without default for new rows)
ALTER TABLE "messages" ALTER COLUMN "name" DROP DEFAULT;
