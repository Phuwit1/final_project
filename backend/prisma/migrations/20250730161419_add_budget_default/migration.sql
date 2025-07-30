/*
  Warnings:

  - A unique constraint covering the columns `[plan_id]` on the table `Budget` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Budget" ADD COLUMN     "plan_id" INTEGER,
ALTER COLUMN "trip_id" DROP NOT NULL,
ALTER COLUMN "total_budget" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Budget_plan_id_key" ON "public"."Budget"("plan_id");

-- AddForeignKey
ALTER TABLE "public"."Budget" ADD CONSTRAINT "Budget_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."TripPlan"("plan_id") ON DELETE CASCADE ON UPDATE CASCADE;
