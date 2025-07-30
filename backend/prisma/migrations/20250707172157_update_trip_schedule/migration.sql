/*
  Warnings:

  - You are about to drop the column `plan_id` on the `TripSchedule` table. All the data in the column will be lost.
  - You are about to drop the `TripPlan` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `date` to the `TripSchedule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `trip_id` to the `TripSchedule` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "TripPlan" DROP CONSTRAINT "TripPlan_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "TripSchedule" DROP CONSTRAINT "TripSchedule_plan_id_fkey";

-- AlterTable
ALTER TABLE "TripSchedule" DROP COLUMN "plan_id",
ADD COLUMN     "date" DATE NOT NULL,
ADD COLUMN     "trip_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "TripPlan";

-- AddForeignKey
ALTER TABLE "TripSchedule" ADD CONSTRAINT "TripSchedule_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "TripGroup"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;
