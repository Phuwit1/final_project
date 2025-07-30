/*
  Warnings:

  - You are about to drop the column `name_group` on the `TripGroup` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `TripSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `trip_id` on the `TripSchedule` table. All the data in the column will be lost.
  - Added the required column `plan_id` to the `TripSchedule` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "TripSchedule" DROP CONSTRAINT "TripSchedule_trip_id_fkey";

-- AlterTable
ALTER TABLE "TripGroup" DROP COLUMN "name_group";

-- AlterTable
ALTER TABLE "TripSchedule" DROP COLUMN "date",
DROP COLUMN "trip_id",
ADD COLUMN     "plan_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "TripPlan" (
    "name_group" VARCHAR(50) NOT NULL,
    "plan_id" SERIAL NOT NULL,
    "trip_id" INTEGER NOT NULL,
    "start_plan_date" DATE NOT NULL,
    "end_plan_date" DATE NOT NULL,
    "day_of_trip" INTEGER NOT NULL,
    "creat_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripPlan_pkey" PRIMARY KEY ("plan_id")
);

-- AddForeignKey
ALTER TABLE "TripPlan" ADD CONSTRAINT "TripPlan_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "TripGroup"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripSchedule" ADD CONSTRAINT "TripSchedule_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "TripPlan"("plan_id") ON DELETE CASCADE ON UPDATE CASCADE;
