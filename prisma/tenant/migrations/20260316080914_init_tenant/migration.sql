-- CreateEnum
CREATE TYPE "StatusType" AS ENUM ('success', 'failed');

-- CreateEnum
CREATE TYPE "ExportTypeEnum" AS ENUM ('csv_stats', 'csv_empower');

-- CreateTable
CREATE TABLE "call" (
    "call_id" VARCHAR(255) NOT NULL,
    "date_start" TIMESTAMP(3),
    "date_answer" TIMESTAMP(3),
    "user_id" VARCHAR(45),
    "user_name" VARCHAR(45),
    "direction" VARCHAR(20),
    "duration" INTEGER,
    "from_number" VARCHAR(25),
    "to_number" VARCHAR(25),
    "is_answered" BOOLEAN,
    "last_state" VARCHAR(25),
    "tags" JSONB,
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "historique_lecture_id" INTEGER,

    CONSTRAINT "call_pkey" PRIMARY KEY ("call_id")
);

-- CreateTable
CREATE TABLE "empower_stats" (
    "empower_id" SERIAL NOT NULL,
    "call_uuid" VARCHAR(255),
    "call_id" VARCHAR(255),
    "score_global" DOUBLE PRECISION,
    "customer_sentiment" VARCHAR(255),
    "moments" JSONB,
    "transcription" TEXT,
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3),

    CONSTRAINT "empower_stats_pkey" PRIMARY KEY ("empower_id")
);

-- CreateTable
CREATE TABLE "exports" (
    "id" SERIAL NOT NULL,
    "export_type" "ExportTypeEnum" NOT NULL,
    "file_path" VARCHAR(255) NOT NULL,
    "status" "StatusType" NOT NULL DEFAULT 'failed',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "historique_lecture_id" INTEGER NOT NULL,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empower_stats_call_id_key" ON "empower_stats"("call_id");
