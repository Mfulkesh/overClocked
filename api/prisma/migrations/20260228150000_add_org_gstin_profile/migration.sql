-- Add GST onboarding/profile fields for orgs
ALTER TABLE "Org"
ADD COLUMN "onchainGstinHash" TEXT,
ADD COLUMN "gstin" TEXT,
ADD COLUMN "gstinVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "gstinLegalName" TEXT,
ADD COLUMN "gstinTradeName" TEXT,
ADD COLUMN "gstinState" TEXT,
ADD COLUMN "gstinStateCode" TEXT,
ADD COLUMN "gstinStatus" TEXT,
ADD COLUMN "gstinRegistrationDate" TEXT,
ADD COLUMN "gstinVerifiedAt" TIMESTAMP(3),
ADD COLUMN "gstinLastCheckedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Org_gstin_key" ON "Org"("gstin");
