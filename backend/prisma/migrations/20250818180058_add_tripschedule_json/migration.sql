/*
  Warnings:

  - A unique constraint covering the columns `[plan_id]` on the table `TripSchedule` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TripSchedule_plan_id_key" ON "TripSchedule"("plan_id");
