-- CreateEnum
CREATE TYPE "PaymentRecordStatus" AS ENUM ('WAITING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "claimedAmount" BIGINT NOT NULL,
    "senderAccountName" TEXT NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "status" "PaymentRecordStatus" NOT NULL DEFAULT 'WAITING_VERIFICATION',
    "rejectionReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storageKey_key" ON "attachments"("storageKey");

-- CreateIndex
CREATE INDEX "attachments_uploadedById_idx" ON "attachments"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "payments_attachmentId_key" ON "payments"("attachmentId");

-- CreateIndex
CREATE INDEX "payments_status_createdAt_idx" ON "payments"("status", "createdAt");

-- CreateIndex
CREATE INDEX "payments_shipmentId_createdAt_idx" ON "payments"("shipmentId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
