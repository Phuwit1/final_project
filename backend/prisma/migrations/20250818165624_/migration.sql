/*
  Warnings:

  - You are about to drop the column `activity` on the `TripSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `creat_at` on the `TripSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `TripSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `TripSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `time` on the `TripSchedule` table. All the data in the column will be lost.
  - Added the required column `payload` to the `TripSchedule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `TripSchedule` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TripSchedule" DROP COLUMN "activity",
DROP COLUMN "creat_at",
DROP COLUMN "date",
DROP COLUMN "description",
DROP COLUMN "time",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "payload" JSONB NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
