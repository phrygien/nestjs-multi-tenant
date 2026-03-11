/*
  Warnings:

  - A unique constraint covering the columns `[call_uuid]` on the table `empower_stats` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[call_id]` on the table `empower_stats` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "empower_stats_call_uuid_key" ON "empower_stats"("call_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "empower_stats_call_id_key" ON "empower_stats"("call_id");
