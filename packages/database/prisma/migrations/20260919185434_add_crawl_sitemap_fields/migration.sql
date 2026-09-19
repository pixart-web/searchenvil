-- AlterTable
ALTER TABLE "crawls" ADD COLUMN     "robotsTxtFound" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sitemapUrls" JSONB;
