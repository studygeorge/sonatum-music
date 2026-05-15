-- AlterTable
ALTER TABLE "sheet_music" ADD COLUMN     "arrangerId" TEXT,
ADD COLUMN     "instrumentation" TEXT;

-- AlterTable
ALTER TABLE "tracks" ADD COLUMN     "chantType" TEXT,
ADD COLUMN     "confession" TEXT,
ADD COLUMN     "eraId" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "serviceType" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "favoriteComposers" JSONB,
ADD COLUMN     "favoriteEras" JSONB;

-- AddForeignKey
ALTER TABLE "sheet_music" ADD CONSTRAINT "sheet_music_arrangerId_fkey" FOREIGN KEY ("arrangerId") REFERENCES "artists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
