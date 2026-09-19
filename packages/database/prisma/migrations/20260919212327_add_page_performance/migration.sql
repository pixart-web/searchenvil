-- CreateEnum
CREATE TYPE "PerformanceStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "page_performance" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "status" "PerformanceStatus" NOT NULL DEFAULT 'PENDING',
    "ttfbMs" INTEGER,
    "domContentLoadedMs" INTEGER,
    "loadTimeMs" INTEGER,
    "lcpMs" INTEGER,
    "cls" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_performance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "page_performance_pageId_key" ON "page_performance"("pageId");

-- AddForeignKey
ALTER TABLE "page_performance" ADD CONSTRAINT "page_performance_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "crawl_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
