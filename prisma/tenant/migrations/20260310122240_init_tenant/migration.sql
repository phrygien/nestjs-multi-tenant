/*
  Warnings:

  - You are about to drop the column `sentiment` on the `empower_stats` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "empower_stats" DROP COLUMN "sentiment",
ADD COLUMN     "customer_sentiment" VARCHAR(255);
