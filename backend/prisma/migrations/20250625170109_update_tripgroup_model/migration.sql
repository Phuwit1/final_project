/*
  Warnings:

  - A unique constraint covering the columns `[uniqueCode]` on the table `TripGroup` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `uniqueCode` to the `TripGroup` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TripGroup" ADD COLUMN     "uniqueCode" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TripGroup_uniqueCode_key" ON "TripGroup"("uniqueCode");
