/*
  Warnings:

  - A unique constraint covering the columns `[plan_id]` on the table `TripGroup` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `date` to the `TripSchedule` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "TripPlan" DROP CONSTRAINT "TripPlan_trip_id_fkey";

-- AlterTable
ALTER TABLE "TripGroup" ADD COLUMN     "plan_id" INTEGER;

-- AlterTable
ALTER TABLE "TripSchedule" ADD COLUMN     "date" DATE NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TripGroup_plan_id_key" ON "TripGroup"("plan_id");

-- AddForeignKey
ALTER TABLE "TripGroup" ADD CONSTRAINT "TripGroup_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "TripPlan"("plan_id") ON DELETE CASCADE ON UPDATE CASCADE;
