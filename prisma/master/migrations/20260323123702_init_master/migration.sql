/*
  Warnings:

  - Added the required column `ivr_id` to the `clients` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "ivr_id" VARCHAR(45) NOT NULL;
