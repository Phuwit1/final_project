/*
  Warnings:

  - Added the required column `creator_id` to the `TripPlan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TripPlan" ADD COLUMN     "creator_id" INTEGER NOT NULL;
