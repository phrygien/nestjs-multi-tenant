/*
  Warnings:

  - Added the required column `historique_lecture_id` to the `call` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "call" ADD COLUMN     "historique_lecture_id" INTEGER NOT NULL;
