-- CreateEnum
CREATE TYPE "StatusType" AS ENUM ('success', 'failed');

-- CreateEnum
CREATE TYPE "FileTypeEnum" AS ENUM ('csv_stats', 'csv_empower');

-- CreateEnum
CREATE TYPE "ExportTypeEnum" AS ENUM ('csv_stats', 'csv_empower');

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "client_name" VARCHAR(45) NOT NULL,
    "ftp_host" VARCHAR(45),
    "ftp_user" VARCHAR(45),
    "ftp_pass_encrypted" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_tenant" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "db_url" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domains" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historique_lecture" (
    "id" SERIAL NOT NULL,
    "file_path" VARCHAR(45) NOT NULL,
    "status" "StatusType" NOT NULL DEFAULT 'failed',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "file_type" "FileTypeEnum",

    CONSTRAINT "historique_lecture_pkey" PRIMARY KEY ("id")
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
    "client_id" INTEGER NOT NULL,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_tenant_client_id_idx" ON "client_tenant"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "domains_domain_key" ON "domains"("domain");

-- CreateIndex
CREATE INDEX "domains_client_id_idx" ON "domains"("client_id");

-- CreateIndex
CREATE INDEX "domains_domain_idx" ON "domains"("domain");

-- CreateIndex
CREATE INDEX "exports_client_id_idx" ON "exports"("client_id");

-- AddForeignKey
ALTER TABLE "client_tenant" ADD CONSTRAINT "client_tenant_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
