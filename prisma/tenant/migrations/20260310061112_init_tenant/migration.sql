-- CreateEnum
CREATE TYPE "StatusType" AS ENUM ('success', 'failed');

-- CreateEnum
CREATE TYPE "ExportTypeEnum" AS ENUM ('csv_stats', 'csv_empower');

-- CreateTable
CREATE TABLE "exports" (
    "id" SERIAL NOT NULL,
    "export_type" "ExportTypeEnum" NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "status" "StatusType" NOT NULL DEFAULT 'failed',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "historique_lecture_id" INTEGER NOT NULL,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);
