-- CreateEnum
CREATE TYPE "MilestoneUpdateType" AS ENUM ('PROGRESS', 'EXPENSE', 'PHOTO', 'ANNOUNCEMENT', 'COMPLETION');

-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "dprPhaseLabel" TEXT;

-- CreateTable
CREATE TABLE "MilestoneProof" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "gstin" TEXT,
    "gstinVerified" BOOLEAN NOT NULL DEFAULT false,
    "vendorLegalName" TEXT,
    "vendorState" TEXT,
    "isUnregisteredVendor" BOOLEAN NOT NULL DEFAULT false,
    "invoiceNumber" TEXT,
    "invoiceAmountPaise" BIGINT,
    "invoiceS3Key" TEXT,
    "invoiceHash" TEXT NOT NULL,
    "prevProofHash" TEXT,
    "onchainProofUri" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneUpdate" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "type" "MilestoneUpdateType" NOT NULL DEFAULT 'PROGRESS',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mediaUrls" TEXT[],
    "creatorWallet" TEXT,
    "contentHash" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneProof_milestoneId_key" ON "MilestoneProof"("milestoneId");

-- AddForeignKey
ALTER TABLE "MilestoneProof" ADD CONSTRAINT "MilestoneProof_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneUpdate" ADD CONSTRAINT "MilestoneUpdate_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
