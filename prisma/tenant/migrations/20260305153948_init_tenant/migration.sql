-- CreateTable
CREATE TABLE "call" (
    "call_id" VARCHAR(255) NOT NULL,
    "date_start" TIMESTAMP(3),
    "date_end" TIMESTAMP(3),
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

    CONSTRAINT "call_pkey" PRIMARY KEY ("call_id")
);

-- CreateTable
CREATE TABLE "empower_stats" (
    "empower_id" SERIAL NOT NULL,
    "call_id" VARCHAR(45),
    "score_global" DOUBLE PRECISION,
    "sentiment" VARCHAR(45),
    "moments" JSONB,
    "transcription" TEXT,
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3),

    CONSTRAINT "empower_stats_pkey" PRIMARY KEY ("empower_id")
);

-- AddForeignKey
ALTER TABLE "empower_stats" ADD CONSTRAINT "empower_stats_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call"("call_id") ON DELETE SET NULL ON UPDATE CASCADE;
