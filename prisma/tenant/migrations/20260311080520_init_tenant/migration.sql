/*
  Warnings:

  - You are about to drop the column `file_name` on the `exports` table. All the data in the column will be lost.
  - Added the required column `file_path` to the `exports` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "exports" DROP COLUMN "file_name",
ADD COLUMN     "file_path" VARCHAR(255) NOT NULL;
