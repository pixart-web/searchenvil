/*
  Warnings:

  - You are about to drop the `reports` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `usage_records` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_crawlId_fkey";

-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_projectId_fkey";

-- DropForeignKey
ALTER TABLE "usage_records" DROP CONSTRAINT "usage_records_organizationId_fkey";

-- DropTable
DROP TABLE "reports";

-- DropTable
DROP TABLE "usage_records";
