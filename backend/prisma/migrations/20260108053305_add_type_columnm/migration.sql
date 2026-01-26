-- AlterTable
ALTER TABLE "CacheAttraction" ADD COLUMN     "place_types" TEXT[] DEFAULT ARRAY[]::TEXT[];
