/*
  Warnings:

  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[privyId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[walletAddress]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "OrgCategory" AS ENUM ('STUDENT_ORG', 'NGO', 'DAO', 'COMMUNITY', 'CHARITY', 'OPEN_SOURCE', 'OTHER');

-- CreateEnum
CREATE TYPE "CampaignState" AS ENUM ('ACTIVE', 'COMPLETED', 'FAILED', 'FROZEN');

-- CreateEnum
CREATE TYPE "MilestoneState" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('SOL', 'UPI');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "name",
DROP COLUMN "password",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "privyId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "twitterHandle" TEXT,
ADD COLUMN     "walletAddress" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Org" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "OrgCategory" NOT NULL DEFAULT 'OTHER',
    "websiteUrl" TEXT,
    "twitterHandle" TEXT,
    "logoUrl" TEXT,
    "docUrls" TEXT[],
    "onchainPda" TEXT,
    "campaignsCreated" INTEGER NOT NULL DEFAULT 0,
    "campaignsCompleted" INTEGER NOT NULL DEFAULT 0,
    "campaignsFailed" INTEGER NOT NULL DEFAULT 0,
    "totalRaisedLamports" BIGINT NOT NULL DEFAULT 0,
    "completionRateBps" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "bannerUrl" TEXT,
    "tags" TEXT[],
    "onchainProjectPda" TEXT,
    "onchainVaultPda" TEXT,
    "projectIdBytes" TEXT,
    "hasGoal" BOOLEAN NOT NULL DEFAULT true,
    "totalGoalLamports" BIGINT NOT NULL DEFAULT 0,
    "raisedLamports" BIGINT NOT NULL DEFAULT 0,
    "state" "CampaignState" NOT NULL DEFAULT 'ACTIVE',
    "prefrontLamports" BIGINT NOT NULL DEFAULT 0,
    "prefrontTranches" INTEGER NOT NULL DEFAULT 0,
    "prefrontClaimed" INTEGER NOT NULL DEFAULT 0,
    "yieldPolicy" INTEGER NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amountLamports" BIGINT NOT NULL DEFAULT 0,
    "releasePctBps" INTEGER NOT NULL DEFAULT 0,
    "proofUri" TEXT,
    "proofNote" TEXT,
    "thresholdBps" INTEGER NOT NULL DEFAULT 5100,
    "quorumBps" INTEGER NOT NULL DEFAULT 1000,
    "votingWindowSecs" INTEGER NOT NULL DEFAULT 172800,
    "deadline" TIMESTAMP(3),
    "state" "MilestoneState" NOT NULL DEFAULT 'PENDING',
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT,
    "donorWallet" TEXT,
    "amountLamports" BIGINT NOT NULL,
    "amountInr" INTEGER,
    "paymentType" "PaymentType" NOT NULL DEFAULT 'SOL',
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "txSignature" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YieldAccrual" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "yieldLamports" BIGINT NOT NULL,
    "periodDate" TIMESTAMP(3) NOT NULL,
    "yieldRateBps" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YieldAccrual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Org_userId_key" ON "Org"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Org_onchainPda_key" ON "Org"("onchainPda");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_onchainProjectPda_key" ON "Campaign"("onchainProjectPda");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_onchainVaultPda_key" ON "Campaign"("onchainVaultPda");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_razorpayOrderId_key" ON "Donation"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_razorpayPaymentId_key" ON "Donation"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_txSignature_key" ON "Donation"("txSignature");

-- CreateIndex
CREATE UNIQUE INDEX "User_privyId_key" ON "User"("privyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- AddForeignKey
ALTER TABLE "Org" ADD CONSTRAINT "Org_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YieldAccrual" ADD CONSTRAINT "YieldAccrual_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
