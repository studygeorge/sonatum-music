-- CreateEnum
CREATE TYPE "AudioType" AS ENUM ('FULL', 'INSTRUMENTAL', 'BOTH');

-- AlterTable
ALTER TABLE "tracks" 
  ADD COLUMN "audioType" "AudioType" NOT NULL DEFAULT 'FULL',
  ADD COLUMN "instrumentalUrl" TEXT,
  ADD COLUMN "instrumentalPrice" DECIMAL(10,2);
