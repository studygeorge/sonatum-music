-- AddTable: copyright_claims
CREATE TABLE "copyright_claims" (
    "id" TEXT NOT NULL,
    "claimantName" TEXT NOT NULL,
    "claimantOrg" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "workTitle" TEXT NOT NULL,
    "workAuthor" TEXT NOT NULL,
    "infringingUrl" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ip" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "copyright_claims_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "copyright_claims_email_idx" ON "copyright_claims"("email");
CREATE INDEX "copyright_claims_status_idx" ON "copyright_claims"("status");
CREATE INDEX "copyright_claims_createdAt_idx" ON "copyright_claims"("createdAt");
