/*
  Warnings:

  - You are about to drop the `exports` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "exports" DROP CONSTRAINT "exports_client_id_fkey";

-- DropTable
DROP TABLE "exports";

-- DropEnum
DROP TYPE "ExportTypeEnum";
