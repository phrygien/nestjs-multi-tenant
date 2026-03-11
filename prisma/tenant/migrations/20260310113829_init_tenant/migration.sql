/*
  Warnings:

  - You are about to alter the column `call_uuid` on the `empower_stats` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.

*/
-- DropForeignKey
ALTER TABLE "empower_stats" DROP CONSTRAINT "empower_stats_call_id_fkey";

-- AlterTable
ALTER TABLE "empower_stats" ALTER COLUMN "call_id" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "sentiment" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "call_uuid" SET DATA TYPE VARCHAR(255);

-- AddForeignKey
ALTER TABLE "empower_stats" ADD CONSTRAINT "empower_stats_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call"("call_id") ON DELETE SET NULL ON UPDATE CASCADE;
